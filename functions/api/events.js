// First-party aggregate metrics. There is intentionally no public read endpoint.
const EVENTS = new Set([
  "page_view", "click_whatsapp", "click_catalog", "open_bonus",
  "click_bonus_whatsapp", "click_instagram", "click_tiktok"
]);
const SOURCES = new Set(["direct", "instagram", "tiktok", "whatsapp", "facebook", "google", "other"]);
const DEVICES = new Set(["mobile", "desktop"]);
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const MAX_BYTES = 512;

function reply(status) {
  return new Response(null, { status, headers: HEADERS });
}

export async function onRequest(context) {
  const request = context.request;
  if (request.method !== "POST") return reply(405);
  if (new URL(request.url).origin !== "https://altagama.upfunnel.click" ||
      request.headers.get("Origin") !== "https://altagama.upfunnel.click") return reply(403);
  const site = request.headers.get("Sec-Fetch-Site");
  if (site && site !== "same-origin") return reply(403);
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) return reply(415);
  if (Number(request.headers.get("Content-Length")) > MAX_BYTES) return reply(413);
  if (!request.body) return reply(400);

  // Bound the stream itself; Content-Length alone is not a trustworthy limit.
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); return reply(413); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return reply(400);
  } finally {
    reader.releaseLock();
  }

  let data;
  try { data = JSON.parse(text); } catch { return reply(400); }
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      !EVENTS.has(data.event) || !SOURCES.has(data.source) || !DEVICES.has(data.device) ||
      typeof data.test !== "boolean" ||
      Object.keys(data).some(key => !["event", "source", "device", "test"].includes(key))) return reply(400);
  if (/bot|crawler|spider|lighthouse/i.test(request.headers.get("User-Agent") || "")) return reply(204);

  const dateParts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = type => dateParts.find(p => p.type === type).value;
  const day = `${part("year")}-${part("month")}-${part("day")}`;
  try {
    await context.env.METRICS_DB.prepare(
      `INSERT INTO metric_counts (day, event, source, device, is_test, total)
       VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT (day, event, source, device, is_test)
       DO UPDATE SET total = total + 1`
    ).bind(day, data.event, data.source, data.device, data.test ? 1 : 0).run();
  } catch {
    console.error(JSON.stringify({ event: "metrics_write_failed" }));
    return reply(503);
  }
  return reply(204);
}
