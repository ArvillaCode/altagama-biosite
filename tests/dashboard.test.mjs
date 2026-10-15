import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { verifyToken, authenticate } from '../lib/access.js';
import { parseRange, buildReport } from '../lib/report.js';
import { onRequest as reportHandler } from '../functions/panel/api/report.js';
import { readFile } from 'node:fs/promises';

const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = await exportJWK(publicKey);
jwk.kid = 'test-key'; jwk.alg = 'RS256'; jwk.use = 'sig';
const keys = createLocalJWKSet({ keys: [jwk] });
async function token(options = {}) {
  return new SignJWT({ email: options.email || 'owner@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(options.issuer || 'https://upfunnel.cloudflareaccess.com')
    .setAudience(options.audience || 'test-audience')
    .setIssuedAt().setExpirationTime(options.expiry || '10m').sign(privateKey);
}

test('accepts only a valid signed token for the app and allowed email', async () => {
  assert.deepEqual(await verifyToken(await token(), 'test-audience', 'owner@example.com', keys), { email: 'owner@example.com' });
});
test('rejects wrong audience, issuer, email and expired signatures', async () => {
  for (const options of [{ audience: 'other-app' }, { issuer: 'https://example.com' }, { email: 'other@example.com' }, { expiry: Math.floor(Date.now() / 1000) - 60 }]) {
    assert.equal(await verifyToken(await token(options), 'test-audience', 'owner@example.com', keys), null);
  }
});
test('rejects an unsigned or modified token', async () => {
  const good = await token();
  const chunks = good.split('.');
  chunks[1] = Buffer.from(JSON.stringify({ email: 'owner@example.com', aud: 'test-audience', exp: 9999999999 })).toString('base64url');
  assert.equal(await verifyToken(chunks.join('.'), 'test-audience', 'owner@example.com', keys), null);
  assert.equal(await verifyToken('eyJhbGciOiJub25lIn0.e30.', 'test-audience', 'owner@example.com', keys), null);
});
test('alternate Pages hostnames cannot bypass authorization', async () => {
  const request = new Request('https://altagama-biosite.pages.dev/panel/api/report', { headers: { 'Cf-Access-Jwt-Assertion': await token() } });
  assert.equal(await authenticate(request, { METRICS_ACCESS_AUD: 'test-audience', METRICS_ALLOWED_EMAILS: 'owner@example.com' }), null);
});
test('validates exact calendar dates and limits the report to 90 days', () => {
  const range = query => parseRange(new URL('https://example.com/?' + query), '2026-10-14');
  assert.deepEqual(range('start=2026-10-08&end=2026-10-14'), { start: '2026-10-08', end: '2026-10-14' });
  for (const query of ['start=2026-02-30&end=2026-03-03', 'start=2026-10-15&end=2026-10-16', 'start=2026-01-01&end=2026-10-14', 'start=2026-10-14&end=2026-10-08', 'end=bad']) assert.equal(range(query), null);
});
test('compares equal periods, keeps current breakdown and excludes test data in one read', async () => {
  const records = [
    { day: '2026-10-01', event: 'page_view', source: 'instagram', device: 'mobile', total: 5 },
    { day: '2026-10-14', event: 'page_view', source: 'instagram', device: 'mobile', total: 10 },
    { day: '2026-10-14', event: 'page_view', source: 'direct', device: 'desktop', total: 3 },
    { day: '2026-10-14', event: 'click_whatsapp', source: 'instagram', device: 'mobile', total: 4 }
  ];
  let reads = 0;
  const db = { prepare(sql) { assert.match(sql, /is_test = 0/); return { bind(start, end) {
    assert.equal(start, '2026-10-01'); assert.equal(end, '2026-10-14');
    return { async all() { reads++; return { success: true, results: records }; } };
  } }; } };
  const result = await buildReport(db, { start: '2026-10-08', end: '2026-10-14' });
  assert.equal(reads, 1);
  assert.equal(result.events.page_view, 13);
  assert.equal(result.events.click_whatsapp, 4);
  assert.equal(result.previous.events.page_view, 5);
  assert.deepEqual(result.previous.range, { start: '2026-10-01', end: '2026-10-07' });
  assert.equal(result.breakdown.length, 3);
  assert.equal(result.daily.find(row => row.event === 'page_view').total, 13);
  assert.equal(result.devices.find(row => row.device === 'mobile' && row.event === 'page_view').total, 10);
});
test('the report endpoint denies requests that did not pass middleware', async () => {
  const response = await reportHandler({ data: {}, request: new Request('https://altagama.upfunnel.click/panel/api/report'), env: {} });
  assert.equal(response.status, 401);
});
test('public entry stays outside Functions while dashboard and report use protected routes', async () => {
  const routes = JSON.parse(await readFile(new URL('../_routes.json', import.meta.url), 'utf8'));
  assert.equal(routes.include.includes('/panel'), false);
  for (const path of ['/panel/dashboard', '/panel/dashboard/*', '/panel/api/*']) assert.ok(routes.include.includes(path));
  const entry = await readFile(new URL('../panel/index.html', import.meta.url), 'utf8');
  assert.match(entry, /href="\/panel\/dashboard\/"/);
});
