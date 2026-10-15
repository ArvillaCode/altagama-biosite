import { authenticate } from '../../lib/access.js';

export async function onRequest(context) {
  const identity = await authenticate(context.request, context.env);
  if (!identity) {
    return Response.json({ error: 'authentication_required' }, {
      status: 401, headers: { 'Cache-Control': 'no-store' }
    });
  }
  context.data.identity = identity;
  const original = await context.next();
  const response = new Response(original.body, original);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  return response;
}
