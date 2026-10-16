import { defaultConfig, readSiteConfig, validateConfig } from '../../../lib/site-config.js';

const HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const MAX_BYTES = 15000;
const json = (data, status = 200) => Response.json(data, { status, headers: HEADERS });

async function bodyWithinLimit(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES || !request.body) return null;
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const all = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(all));
  } catch { return null; } finally { reader.releaseLock(); }
}

export async function onRequest({ request, env, data }) {
  if (!data.identity) return json({ error: 'authentication_required' }, 401);
  if (request.method === 'GET') {
    try { return json(await readSiteConfig(env.METRICS_DB)); }
    catch { return json({ error: 'configuration_unavailable' }, 503); }
  }
  if (!['PUT', 'POST'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405);
  if (request.headers.get('Origin') !== 'https://altagama.upfunnel.click' ||
      (request.headers.get('Sec-Fetch-Site') && request.headers.get('Sec-Fetch-Site') !== 'same-origin')) return json({ error: 'origin_forbidden' }, 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'unsupported_media_type' }, 415);
  const body = await bodyWithinLimit(request);
  if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0) return json({ error: 'invalid_request' }, 400);
  if (request.method === 'PUT' && !validateConfig(body.draft)) return json({ error: 'invalid_configuration' }, 400);
  if (request.method === 'POST' && body.action !== 'publish') return json({ error: 'invalid_action' }, 400);
  try {
    const current = await readSiteConfig(env.METRICS_DB);
    if (current.draftRevision !== body.revision) return json({ error: 'revision_conflict', current }, 409);
    const now = new Date().toISOString();
    if (request.method === 'PUT') {
      const draftJson = JSON.stringify(body.draft), initialJson = JSON.stringify(defaultConfig);
      const result = await env.METRICS_DB.prepare(`INSERT INTO site_config
        (id,draft_json,published_json,draft_revision,published_revision,updated_at,published_at)
        VALUES (1,?,?,1,0,?,NULL)
        ON CONFLICT(id) DO UPDATE SET draft_json=excluded.draft_json,
          draft_revision=site_config.draft_revision+1,updated_at=excluded.updated_at
        WHERE site_config.draft_revision=?`)
        .bind(draftJson, initialJson, now, body.revision).run();
      if (!result.meta?.changes) return json({ error: 'revision_conflict' }, 409);
    } else {
      if (body.revision === 0) {
        await env.METRICS_DB.prepare(`INSERT OR IGNORE INTO site_config
          (id,draft_json,published_json,draft_revision,published_revision,updated_at,published_at)
          VALUES (1,?,?,0,0,?,NULL)`).bind(JSON.stringify(defaultConfig), JSON.stringify(defaultConfig), now).run();
      }
      const result = await env.METRICS_DB.prepare(`UPDATE site_config SET published_json=draft_json,
        published_revision=draft_revision,published_at=? WHERE id=1 AND draft_revision=?`)
        .bind(now, body.revision).run();
      if (!result.meta?.changes) return json({ error: 'revision_conflict' }, 409);
    }
    return json(await readSiteConfig(env.METRICS_DB));
  } catch {
    console.error(JSON.stringify({ event: 'site_config_write_failed' }));
    return json({ error: 'save_failed' }, 503);
  }
}
