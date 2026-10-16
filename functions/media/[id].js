export async function onRequest({ request, env, params }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
  const key = params.id;
  if (!/^[0-9a-f-]{36}\.(?:png|jpg|webp)$/.test(key || '') || !env.SITE_MEDIA) return new Response(null, { status: 404 });
  const object = await env.SITE_MEDIA.get(key);
  if (!object) return new Response(null, { status: 404 });
  return new Response(request.method === 'HEAD' ? null : object.body, { headers: {
    'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff'
  } });
}
