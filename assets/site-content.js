(() => {
  'use strict';
  const one = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const text = (selector, value) => { const el = one(selector); if (el) el.textContent = value; };
  const attr = (selector, name, value) => { const el = one(selector); if (el) el.setAttribute(name, value); };
  let colorStyle;

  function apply(config) {
    if (!config?.brand || !config?.offer || !config?.links || !config?.colors) return;
    text('.brand .slogan', config.brand.slogan);
    text('.mobile-site footer small', config.brand.slogan);
    attr('.brand>img', 'src', config.brand.logo);
    attr('.hero-film video', 'poster', config.brand.heroPoster);
    const source = one('.hero-film video source');
    if (source && source.getAttribute('src') !== config.brand.heroVideo) {
      source.src = config.brand.heroVideo;
      source.parentElement.load();
    }
    attr('.footer-scene', 'src', config.brand.footerImage);
    for (const [selector, value] of [['.promo b', config.offer.label], ['.promo strong', config.offer.title],
      ['.promo small', config.offer.description], ['#bonus-title', config.offer.modalTitle],
      ['.modal p', config.offer.modalDescription], ['.modal a', config.offer.buttonLabel]]) text(selector, value);
    for (const [name, selector] of Object.entries({ tiktok: '.social-btn.tiktok', catalog: '.social-btn.website', whatsapp: '.social-btn.whatsapp', instagram: '.social-btn.instagram' })) {
      const link = one(selector);
      if (link && config.links[name]) { link.href = config.links[name].url; text(`${selector} .btn-label`, config.links[name].label); }
    }
    attr('.modal a', 'href', config.links.bonusWhatsapp.url);
    all('.review').forEach((review, index) => {
      const entry = config.reviews?.[index]; if (!entry) return;
      review.querySelector('p').textContent = `“${entry.quote}”`;
      review.querySelector('.reviewer').textContent = `— ${entry.name}`;
      review.querySelector('img').src = entry.image;
    });
    const c = config.colors;
    document.documentElement.style.setProperty('--cms-bg', c.background);
    document.documentElement.style.setProperty('--cms-accent', c.accent);
    document.documentElement.style.setProperty('--cms-text', c.text);
    if (!colorStyle) {
      colorStyle = document.createElement('style');
      colorStyle.textContent = `html,body,.site,.mobile-site{background-color:var(--cms-bg)!important;color:var(--cms-text)!important}
        .brand{background-color:var(--cms-bg)!important}.promo,.social-btn.gold,.review,.modal{border-color:var(--cms-accent)!important}
        .promo b,.reviews h2,.mobile-site footer span,.eyebrow{color:var(--cms-accent)!important}
        .modal a{background:var(--cms-accent)!important}`;
      document.head.append(colorStyle);
    }
  }

  window.addEventListener('message', event => {
    if (window.parent === window || event.origin !== location.origin || event.data?.type !== 'altagama-preview') return;
    apply(event.data.config);
  });
  fetch('/api/site', { headers: { Accept: 'application/json' } })
    .then(response => response.ok ? response.json() : null).then(config => { if (config) apply(config); })
    .catch(() => {})
    .finally(() => { if (window.parent !== window) window.parent.postMessage({ type: 'altagama-preview-ready' }, location.origin); });
})();
