import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/events.js';

const valid = { event: 'click_whatsapp', source: 'instagram', device: 'mobile', test: true };
function context(data = valid, options = {}) {
  const calls = [];
  const request = new Request('https://altagama.upfunnel.click/api/events', {
    method: 'POST',
    headers: { Origin: 'https://altagama.upfunnel.click', 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(data)
  });
  const env = { METRICS_DB: { prepare(sql) {
    return { bind(...params) {
      calls.push({ sql, params });
      return { async run() { if (options.fail) throw new Error('test database failure'); } };
    } };
  } } };
  return { request, env, calls };
}

test('writes a test count using bound values, without IP or full URLs', async () => {
  const c = context();
  const response = await onRequest(c);
  assert.equal(response.status, 204);
  assert.equal(c.calls.length, 1);
  assert.match(c.calls[0].sql, /ON CONFLICT/);
  assert.deepEqual(c.calls[0].params.slice(1), ['click_whatsapp', 'instagram', 'mobile', 1]);
  assert.match(c.calls[0].params[0], /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('does not expose statistics through GET', async () => {
  const c = context();
  c.request = new Request('https://altagama.upfunnel.click/api/events');
  assert.equal((await onRequest(c)).status, 405);
  assert.equal(c.calls.length, 0);
});

test('rejects another origin before any write', async () => {
  const c = context(valid, { headers: { Origin: 'https://example.com' } });
  assert.equal((await onRequest(c)).status, 403);
  assert.equal(c.calls.length, 0);
});

test('rejects unknown events and additional fields', async () => {
  for (const data of [{ ...valid, event: 'purchase' }, { ...valid, email: 'not-collected@example.com' }]) {
    const c = context(data);
    assert.equal((await onRequest(c)).status, 400);
    assert.equal(c.calls.length, 0);
  }
});

test('limits a streamed body even without Content-Length', async () => {
  const c = context();
  c.request = new Request('https://altagama.upfunnel.click/api/events', {
    method: 'POST', headers: { Origin: 'https://altagama.upfunnel.click', 'Content-Type': 'application/json' },
    body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(600)); controller.close(); } }),
    duplex: 'half'
  });
  assert.equal((await onRequest(c)).status, 413);
  assert.equal(c.calls.length, 0);
});

test('ignores obvious crawler traffic', async () => {
  const c = context(valid, { headers: { 'User-Agent': 'ExampleBot/1.0' } });
  assert.equal((await onRequest(c)).status, 204);
  assert.equal(c.calls.length, 0);
});

test('returns an explicit error if persistence fails', async () => {
  const c = context(valid, { fail: true });
  assert.equal((await onRequest(c)).status, 503);
});
