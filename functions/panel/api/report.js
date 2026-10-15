import { parseRange, buildReport } from '../../../lib/report.js';

export async function onRequest(context) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!context.data.identity) return Response.json({ error: 'authentication_required' }, { status: 401, headers });
  if (context.request.method !== 'GET') return Response.json({ error: 'method_not_allowed' }, { status: 405, headers });
  const range = parseRange(new URL(context.request.url));
  if (!range) return Response.json({ error: 'invalid_range' }, { status: 400, headers });
  try {
    return Response.json(await buildReport(context.env.METRICS_DB, range), { headers });
  } catch {
    console.error(JSON.stringify({ event: 'metrics_report_failed' }));
    return Response.json({ error: 'report_unavailable' }, { status: 503, headers });
  }
}
