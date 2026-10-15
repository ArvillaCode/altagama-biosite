(() => {
  "use strict";
  // No cookies, visitor identifiers, raw URLs, IPs, or form values are recorded.
  if (location.hostname !== "altagama.upfunnel.click" && location.hostname !== "127.0.0.1") return;
  const params = new URLSearchParams(location.search);
  let mode = params.get("medicion");
  try {
    if (mode === "prueba" || mode === "off") sessionStorage.setItem("altagama:metrics-mode", mode);
    else if (mode === "on") sessionStorage.removeItem("altagama:metrics-mode");
    if (!mode || mode === "on") mode = sessionStorage.getItem("altagama:metrics-mode");
  } catch { /* Measurement never depends on browser storage availability. */ }
  const test = mode === "prueba";
  if (mode === "off" || (navigator.webdriver && !test) || navigator.globalPrivacyControl === true) return;

  const normalize = value => {
    const source = (value || "").toLowerCase();
    if (["instagram", "ig"].includes(source)) return "instagram";
    if (["tiktok", "tik_tok"].includes(source)) return "tiktok";
    if (["whatsapp", "wa"].includes(source)) return "whatsapp";
    if (["facebook", "fb"].includes(source)) return "facebook";
    if (source === "google") return "google";
    return source ? "other" : "direct";
  };
  let source;
  if (params.has("utm_source")) source = normalize(params.get("utm_source"));
  else {
    let host = "";
    try { host = new URL(document.referrer).hostname.toLowerCase(); } catch { /* Direct entry. */ }
    const from = domain => host === domain || host.endsWith("." + domain);
    source = !host || host === location.hostname ? "direct" :
      from("instagram.com") ? "instagram" : from("tiktok.com") ? "tiktok" :
      from("whatsapp.com") || host === "wa.me" ? "whatsapp" :
      from("facebook.com") || host === "fb.me" ? "facebook" :
      from("google.com") ? "google" : "other";
  }
  const device = matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
  const recent = new Map();
  function track(event) {
    try {
      const now = performance.now();
      if (recent.has(event) && now - recent.get(event) < 600) return;
      recent.set(event, now);
      const body = JSON.stringify({ event, source, device, test });
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon && navigator.sendBeacon("/api/events", blob)) return;
      void fetch("/api/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body, keepalive: true, credentials: "omit"
      }).catch(() => {});
    } catch { /* Keep navigation and the bonus working even if metrics fail. */ }
  }
  let viewed = false;
  function recordView() {
    if (!viewed && document.visibilityState === "visible") { viewed = true; track("page_view"); }
  }
  document.addEventListener("visibilitychange", recordView);
  recordView();
  document.addEventListener("click", event => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest("[data-metric]");
    if (target) track(target.dataset.metric);
  }, { passive: true });
})();
