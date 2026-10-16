import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, validateConfig, readSiteConfig } from '../lib/site-config.js';
import { onRequest as adminSite } from '../functions/panel/api/site.js';
import { onRequest as publicSite } from '../functions/api/site.js';
import { onRequest as uploadMedia } from '../functions/panel/api/media.js';

const copy = () => structuredClone(defaultConfig);

test('configuration accepts the live design and rejects unsafe links, media paths and colors', () => {
  assert.equal(validateConfig(copy()), true);
  for (const change of [
    c => { c.links.catalog.url = 'javascript:alert(1)'; },
    c => { c.brand.logo = 'https://example.com/tracker.png'; },
    c => { c.colors.accent = 'red; background:url(x)'; },
    c => { c.reviews[0].quote = ''; }
  ]) { const c = copy(); change(c); assert.equal(validateConfig(c), false); }
});

test('public response contains only published configuration', async () => {
  const published = copy(), draft = copy(); draft.brand.slogan = 'Unpublished draft';
  const db = { prepare() { return { async first() { return { draft_json: JSON.stringify(draft), published_json: JSON.stringify(published), draft_revision: 2, published_revision: 1 }; } }; } };
  const response = await publicSite({ request: new Request('https://altagama.upfunnel.click/api/site'), env: { METRICS_DB: db } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), published);
});

test('editor requires the authenticated middleware identity and same-origin writes', async () => {
  const request = new Request('https://altagama.upfunnel.click/panel/api/site', { method: 'PUT', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: 0, draft: copy() }) });
  assert.equal((await adminSite({ request, env: {}, data: {} })).status, 401);
  assert.equal((await adminSite({ request, env: {}, data: { identity: { email: 'owner@example.com' } } })).status, 403);
});

test('draft save and publish use revisions and keep the previous public version until publication', async () => {
  let row = null;
  const db = { prepare(sql) { return {
    async first() { return row; },
    bind(...values) { return { async run() {
      if (sql.includes('ON CONFLICT(id)')) {
        if (row && row.draft_revision !== values[3]) return { meta: { changes: 0 } };
        row = row || { published_json: values[1], published_revision: 0, published_at: null };
        row.draft_json = values[0]; row.draft_revision = (row.draft_revision || 0) + 1; row.updated_at = values[2];
      } else if (sql.startsWith('UPDATE site_config')) {
        if (row.draft_revision !== values[1]) return { meta: { changes: 0 } };
        row.published_json = row.draft_json; row.published_revision = row.draft_revision; row.published_at = values[0];
      }
      return { meta: { changes: 1 } };
    } }; }
  }; } };
  const draft = copy(); draft.brand.slogan = 'Nueva frase';
  const req = (method, body) => new Request('https://altagama.upfunnel.click/panel/api/site', { method, headers: { Origin: 'https://altagama.upfunnel.click', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const context = { env: { METRICS_DB: db }, data: { identity: { email: 'owner@example.com' } } };
  const saved = await adminSite({ ...context, request: req('PUT', { revision: 0, draft }) });
  assert.equal(saved.status, 200);
  assert.equal((await readSiteConfig(db)).published.brand.slogan, defaultConfig.brand.slogan);
  assert.equal((await adminSite({ ...context, request: req('PUT', { revision: 0, draft }) })).status, 409);
  const published = await adminSite({ ...context, request: req('POST', { revision: 1, action: 'publish' }) });
  assert.equal(published.status, 200);
  assert.equal((await readSiteConfig(db)).published.brand.slogan, 'Nueva frase');
});

test('image upload rejects invalid magic bytes before writing to R2', async () => {
  let writes = 0;
  const request = new Request('https://altagama.upfunnel.click/panel/api/media', { method: 'POST', headers: { Origin: 'https://altagama.upfunnel.click', 'Content-Type': 'image/png' }, body: new Uint8Array([1, 2, 3]) });
  const response = await uploadMedia({ request, env: { SITE_MEDIA: { put() { writes++; } } }, data: { identity: { email: 'owner@example.com' } } });
  assert.equal(response.status, 400); assert.equal(writes, 0);
});
