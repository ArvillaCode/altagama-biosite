const MAX_BYTES = 5 * 1024 * 1024;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (data, status = 200) => Response.json(data, { status, headers });

export async function onRequest({ request, env, data }) {
  if (!data.identity) return reply({ error: 'authentication_required' }, 401);
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  if (request.headers.get('Origin') !== 'https://altagama.upfunnel.click' ||
      (request.headers.get('Sec-Fetch-Site') && request.headers.get('Sec-Fetch-Site') !== 'same-origin')) return reply({ error: 'origin_forbidden' }, 403);
  if (!env.SITE_MEDIA || !request.body) return reply({ error: 'media_unavailable' }, 503);
  const type = request.headers.get('Content-Type')?.split(';')[0];
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(type)) return reply({ error: 'unsupported_image' }, 415);
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) return reply({ error: 'image_too_large' }, 413);
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); return reply({ error: 'image_too_large' }, 413); }
      chunks.push(value);
    }
  } catch { return reply({ error: 'invalid_image' }, 400); } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const png = bytes.length > 8 && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n);
  const jpeg = bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length > 12 && new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
  if (!(type === 'image/png' && png || type === 'image/jpeg' && jpeg || type === 'image/webp' && webp)) return reply({ error: 'invalid_image' }, 400);
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[type];
  const key = `${crypto.randomUUID()}.${ext}`;
  try { await env.SITE_MEDIA.put(key, bytes, { httpMetadata: { contentType: type } }); }
  catch { return reply({ error: 'upload_failed' }, 503); }
  return reply({ path: `/media/${key}` }, 201);
}
