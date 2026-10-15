export function colombiaToday() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const get = type => parts.find(item => item.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function parseRange(url, today = colombiaToday()) {
  const end = url.searchParams.get('end') || today;
  const defaultStart = new Date(`${end}T12:00:00Z`);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);
  const start = url.searchParams.get('start') || (Number.isNaN(defaultStart.getTime()) ? '' : defaultStart.toISOString().slice(0, 10));
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(start) || !valid(end) || start > end || end > today) return null;
  const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  return days <= 90 ? { start, end } : null;
}

export async function buildReport(db, range) {
  const duration = (Date.parse(range.end) - Date.parse(range.start)) / 86400000 + 1;
  const previousEnd = new Date(`${range.start}T12:00:00Z`);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - duration + 1);
  const previous = { start: previousStart.toISOString().slice(0, 10), end: previousEnd.toISOString().slice(0, 10) };
  // One read covers both equal-length periods; test counters never enter the report.
  const result = await db.prepare(
    'SELECT day,event,source,device,total FROM metric_counts WHERE is_test = 0 AND day BETWEEN ? AND ?'
  ).bind(previous.start, range.end).all();
  if (!result.success) throw new Error('report_query_failed');
  const events = new Map(), previousEvents = new Map(), daily = new Map(), sources = new Map(), devices = new Map();
  const breakdown = [];
  const add = (map, key, total) => map.set(key, (map.get(key) || 0) + total);
  for (const row of result.results) {
    const total = Number(row.total);
    if (row.day < range.start) { add(previousEvents, row.event, total); continue; }
    add(events, row.event, total);
    add(daily, `${row.day}|${row.event}`, total);
    add(sources, `${row.source}|${row.event}`, total);
    add(devices, `${row.device}|${row.event}`, total);
    breakdown.push({ day: row.day, event: row.event, source: row.source, device: row.device, total });
  }
  const rows = (map, key) => [...map].map(([value, total]) => {
    const [dimension, event] = value.split('|');
    return { [key]: dimension, event, total };
  });
  return {
    range: { ...range, timezone: 'America/Bogota' },
    events: Object.fromEntries(events),
    previous: { range: previous, events: Object.fromEntries(previousEvents) },
    daily: rows(daily, 'day').sort((a, b) => a.day.localeCompare(b.day)),
    sources: rows(sources, 'source'),
    devices: rows(devices, 'device'),
    breakdown,
    generatedAt: new Date().toISOString()
  };
}
