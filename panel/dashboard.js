(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const numbers = new Intl.NumberFormat('es-CO');
  const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
  const count = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const fmt = value => numbers.format(count(value));
  const sourceNames = { direct: 'Directo / no identificado', instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp', facebook: 'Facebook', google: 'Google', other: 'Otro origen' };
  const buttonNames = [
    ['click_whatsapp', 'WhatsApp principal'], ['click_bonus_whatsapp', 'WhatsApp del bono'],
    ['click_catalog', 'Catálogo / Website'], ['open_bonus', 'Abrir bono'],
    ['click_instagram', 'Instagram'], ['click_tiktok', 'TikTok']
  ];
  let range, busy = false, expired = false, controller, requestId = 0, lastData;

  function today() {
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const get = type => parts.find(item => item.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function shift(day, offset) {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }
  function dayLabel(day) {
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  }
  function message(text = '') { $('status-message').textContent = text; $('status-message').hidden = !text; }
  function setLive(active, text) {
    $('live-badge').classList.toggle('is-live', active);
    $('live-badge').querySelector('span').textContent = text;
  }
  function expire() {
    expired = true;
    lastData = null; $('export-csv').disabled = true;
    $('auth-message').hidden = false;
    for (const id of ['stat-views', 'stat-whatsapp', 'stat-catalog', 'stat-bonus', 'mobile-count', 'desktop-count', 'mobile-percent', 'desktop-percent']) $(id).textContent = '—';
    for (const id of ['chart-container', 'button-list', 'source-list', 'daily-table', 'origin-table']) $(id).replaceChildren();
    for (const id of ['ratio-whatsapp', 'ratio-catalog', 'change-views', 'change-whatsapp', 'change-catalog', 'change-bonus']) $(id).textContent = '—';
    $('updated-at').textContent = 'Sesión terminada';
    setLive(false, 'Sesión cerrada');
    message('');
  }
  function svgNode(name, attributes = {}, text) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function drawChart(data) {
    const byDay = new Map();
    for (const row of data.daily || []) {
      if (!byDay.has(row.day)) byDay.set(row.day, {});
      byDay.get(row.day)[row.event] = count(row.total);
    }
    const days = [];
    for (let day = data.range.start; day <= data.range.end; day = shift(day, 1)) {
      const values = byDay.get(day) || {};
      days.push({ day, visits: count(values.page_view), whatsapp: count(values.click_whatsapp) + count(values.click_bonus_whatsapp) });
    }
    const container = $('chart-container');
    const dailyBody = $('daily-table'); dailyBody.replaceChildren();
    for (const day of days) {
      const row = document.createElement('tr');
      for (const value of [dayLabel(day.day), fmt(day.visits), fmt(day.whatsapp)]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      dailyBody.append(row);
    }
    container.replaceChildren();
    if (!days.some(day => day.visits || day.whatsapp)) {
      const empty = document.createElement('div'); empty.className = 'empty-state';
      const title = document.createElement('strong'); title.textContent = 'Aquí comenzará a verse el movimiento.';
      const description = document.createElement('p'); description.textContent = 'Aún no hay visitas ni clics en WhatsApp registrados para este período. Las pruebas están excluidas.';
      empty.append(title, description); container.append(empty);
    } else {
      const svg = svgNode('svg', { viewBox: '0 0 720 220', class: 'activity-svg', role: 'img', 'aria-label': 'Evolución diaria de cargas de página y clics en WhatsApp; valores exactos en la tabla siguiente' });
      const max = Math.max(1, ...days.flatMap(day => [day.visits, day.whatsapp]));
      const top = Math.ceil(max / 4) * 4;
      const y = value => 184 - value / top * 164;
      const x = index => days.length === 1 ? 378 : 42 + index / (days.length - 1) * 658;
      for (let i = 0; i <= 4; i++) {
        const value = top * i / 4;
        svg.append(svgNode('line', { x1: 42, y1: y(value), x2: 700, y2: y(value), class: 'grid-line' }));
        svg.append(svgNode('text', { x: 32, y: y(value) + 3, 'text-anchor': 'end' }, compact.format(value)));
      }
      for (const index of new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])) {
        svg.append(svgNode('text', { x: x(index), y: 211, 'text-anchor': 'middle' }, dayLabel(days[index].day)));
      }
      for (const [key, className, color] of [['visits', 'visits-line', '#dfbd72'], ['whatsapp', 'whatsapp-line', '#69c798']]) {
        const path = days.map((day, index) => `${index ? 'L' : 'M'}${x(index).toFixed(2)},${y(day[key]).toFixed(2)}`).join(' ');
        svg.append(svgNode('path', { d: path, class: className }));
        if (days.length <= 31) days.forEach((day, index) => {
          const dot = svgNode('circle', { cx: x(index), cy: y(day[key]), r: 2.5, fill: color });
          dot.append(svgNode('title', {}, `${dayLabel(day.day)}: ${fmt(day[key])} ${key === 'visits' ? 'cargas de página' : 'clics en WhatsApp'}`));
          svg.append(dot);
        });
      }
      container.append(svg);
    }
    $('chart-summary').textContent = `${dayLabel(data.range.start)} – ${dayLabel(data.range.end)} · Hora de Colombia · Conteos diarios, sin pruebas.`;
  }

  function drawList(id, entries) {
    const list = $(id); list.replaceChildren();
    const max = Math.max(1, ...entries.map(entry => entry.value));
    for (const entry of entries) {
      const row = document.createElement('div'); row.className = 'metric-row';
      const heading = document.createElement('div'); heading.className = 'metric-row-heading';
      const label = document.createElement('span'); label.textContent = entry.label;
      const value = document.createElement('strong'); value.textContent = fmt(entry.value);
      const bar = document.createElement('progress'); bar.max = max; bar.value = entry.value;
      bar.setAttribute('aria-label', `${entry.label}: ${fmt(entry.value)}`);
      heading.append(label, value); row.append(heading, bar); list.append(row);
    }
    if (!entries.length) {
      const note = document.createElement('p'); note.className = 'loading-copy'; note.textContent = 'Sin visitas registradas en este período.'; list.append(note);
    }
  }
  function render(data) {
    const events = data.events;
    const previous = data.previous?.events || {};
    const whatsapp = count(events.click_whatsapp) + count(events.click_bonus_whatsapp);
    const previousWhatsapp = count(previous.click_whatsapp) + count(previous.click_bonus_whatsapp);
    const comparison = (current, prior) => prior ? `${current - prior >= 0 ? '+' : '−'}${fmt(Math.abs(current - prior))} (${current - prior >= 0 ? '+' : '−'}${Math.round(Math.abs(current - prior) / prior * 100)} %) frente al período anterior` : 'Sin base de comparación anterior';
    $('stat-views').textContent = fmt(events.page_view);
    $('stat-whatsapp').textContent = fmt(whatsapp);
    $('stat-catalog').textContent = fmt(events.click_catalog);
    $('stat-bonus').textContent = fmt(events.open_bonus);
    for (const [id, current, prior] of [['views', count(events.page_view), count(previous.page_view)], ['whatsapp', whatsapp, previousWhatsapp], ['catalog', count(events.click_catalog), count(previous.click_catalog)], ['bonus', count(events.open_bonus), count(previous.open_bonus)]]) $('change-' + id).textContent = comparison(current, prior);
    const views = count(events.page_view);
    $('ratio-whatsapp').textContent = views ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(whatsapp / views * 100) : '—';
    $('ratio-catalog').textContent = views ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(count(events.click_catalog) / views * 100) : '—';
    drawChart(data);
    drawList('button-list', buttonNames.map(([event, label]) => ({ label, value: count(events[event]) })).sort((a, b) => b.value - a.value));
    const sources = (data.sources || []).filter(row => row.event === 'page_view')
      .map(row => ({ label: sourceNames[row.source] || 'Otro origen', value: count(row.total) })).sort((a, b) => b.value - a.value);
    drawList('source-list', sources);
    const origins = new Map();
    for (const row of data.sources || []) {
      if (!origins.has(row.source)) origins.set(row.source, {});
      origins.get(row.source)[row.event] = count(row.total);
    }
    const originBody = $('origin-table'); originBody.replaceChildren();
    for (const [source, totals] of [...origins].sort((a, b) => count(b[1].page_view) - count(a[1].page_view))) {
      const row = document.createElement('tr');
      for (const value of [sourceNames[source] || 'Otro origen', fmt(totals.page_view), fmt(count(totals.click_whatsapp) + count(totals.click_bonus_whatsapp)), fmt(totals.click_catalog)]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      originBody.append(row);
    }
    if (!origins.size) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 4; cell.textContent = 'Sin datos en este período.'; row.append(cell); originBody.append(row); }
    const devices = new Map((data.devices || []).filter(row => row.event === 'page_view').map(row => [row.device, count(row.total)]));
    const total = (devices.get('mobile') || 0) + (devices.get('desktop') || 0);
    for (const device of ['mobile', 'desktop']) {
      $(device + '-count').textContent = fmt(devices.get(device));
      $(device + '-percent').textContent = total ? `${Math.round((devices.get(device) || 0) / total * 100)} %` : '—';
    }
    const time = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' }).format(new Date(data.generatedAt));
    $('updated-at').textContent = `Actualizado ${time} · Colombia`;
  }

  async function load(manual = false) {
    if (expired || !range || (busy && !manual)) return;
    if (manual) controller?.abort();
    const revision = ++requestId;
    controller = new AbortController();
    const localController = controller;
    const timeout = setTimeout(() => localController.abort(), 8000);
    if (lastData && (lastData.range.start !== range.start || lastData.range.end !== range.end)) { lastData = null; $('export-csv').disabled = true; }
    busy = true; $('refresh').disabled = true; $('stats').setAttribute('aria-busy', 'true');
    try {
      const url = new URL('/panel/api/report', location.origin);
      url.searchParams.set('start', range.start); url.searchParams.set('end', range.end);
      const response = await fetch(url, { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin', cache: 'no-store', redirect: 'manual', signal: localController.signal });
      if (revision !== requestId) return;
      if (response.type === 'opaqueredirect' || [0, 401, 403].includes(response.status)) { expire(); return; }
      if (!response.ok) throw new Error(response.status === 400 ? 'range' : 'network');
      if (!response.headers.get('Content-Type')?.includes('application/json')) { expire(); return; }
      const data = await response.json();
      if (revision !== requestId) return;
      if (!data.events || !data.range || !Array.isArray(data.daily)) throw new Error('network');
      render(data); lastData = data; $('export-csv').disabled = false; message(''); setLive(true, 'Actualización activa');
    } catch (error) {
      if (revision !== requestId) return;
      message(error.message === 'range' ? 'Revisa las fechas: puedes consultar hasta 90 días y no seleccionar días futuros.' : 'No pudimos actualizar los datos. Conservamos la última lectura y volveremos a intentarlo.');
      setLive(false, 'Sin actualizar');
    } finally {
      clearTimeout(timeout);
      if (revision === requestId) { busy = false; $('refresh').disabled = false; $('stats').setAttribute('aria-busy', 'false'); }
    }
  }
  function usePreset() {
    const selected = $('period').value;
    $('custom-range').hidden = selected !== 'custom';
    if (selected === 'custom') { $('start-date').value = range.start; $('end-date').value = range.end; return; }
    const end = today(); range = { start: shift(end, 1 - Number(selected)), end }; void load(true);
  }
  $('period').addEventListener('change', usePreset);
  $('export-csv').addEventListener('click', () => {
    if (!lastData || expired) return;
    const escape = value => `"${String(value).replaceAll('"', '""')}"`;
    const lines = [['fecha', 'evento', 'origen', 'dispositivo', 'total'], ...(lastData.breakdown || []).map(row => [row.day, row.event, row.source, row.device, row.total])];
    const csv = '\uFEFF' + lines.map(row => row.map(escape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `altagama-metricas-${lastData.range.start}-${lastData.range.end}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('refresh').addEventListener('click', () => { if ($('period').value !== 'custom') { usePreset(); } else { void load(true); } });
  $('apply-dates').addEventListener('click', () => {
    const start = $('start-date').value, end = $('end-date').value;
    const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
    if (!start || !end || start > end || end > today() || !Number.isFinite(days) || days > 90) { message('Elige fechas válidas: máximo 90 días, hasta hoy.'); return; }
    range = { start, end }; void load(true);
  });
  $('start-date').max = today(); $('end-date').max = today();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !expired) void load(); });
  setInterval(() => {
    if (document.hidden || expired) return;
    const selected = $('period').value;
    if (selected !== 'custom') { const end = today(); range = { start: shift(end, 1 - Number(selected)), end }; }
    void load();
  }, 10000);
  usePreset();
})();
