import { defaultConfig, readSiteConfig } from '../../lib/site-config.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return new Response(null, { status: 405 });
  try {
    const config = env.METRICS_DB ? (await readSiteConfig(env.METRICS_DB)).published : defaultConfig;
    return Response.json(config, { headers: { 'Cache-Control': 'public, max-age=30', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return Response.json(defaultConfig, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
}
