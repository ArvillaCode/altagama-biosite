export const defaultConfig = {
  brand: {
    slogan: 'Eres único, eres Altagama',
    logo: '/assets/logo-vertical.png',
    heroVideo: '/assets/altagama-background-video.mp4',
    heroPoster: '/assets/altagama-background-poster.jpg',
    footerImage: '/assets/footer-objects-clean.webp'
  },
  offer: {
    label: 'BONO REGALO',
    title: 'PRIMERA COMPRA',
    description: 'Reclámalo aquí',
    modalTitle: 'Tu primera compra merece un regalo.',
    modalDescription: 'Consulta con nuestro equipo los beneficios disponibles. El valor, requisitos y vigencia del bono están pendientes de confirmación.',
    buttonLabel: 'Consultar beneficio por WhatsApp ↗'
  },
  links: {
    tiktok: { label: 'TikTok', url: 'https://www.tiktok.com/@altagama_2023' },
    catalog: { label: 'Website', url: 'https://altagamastore.catalog.kyte.site/' },
    whatsapp: { label: 'WhatsApp', url: 'https://wa.me/573194645901?text=Hola%2C%20vengo%20del%20sitio%20de%20Altagama%20Store.%20Quisiera%20informaci%C3%B3n%20sobre%20sus%20productos.' },
    instagram: { label: 'Instagram', url: 'https://www.instagram.com/altagama__2023/' },
    bonusWhatsapp: { url: 'https://wa.me/573194645901?text=Hola%2C%20vi%20el%20bono%20de%20primera%20compra%20en%20el%20micrositio%20de%20Altagama.%20%C2%BFQu%C3%A9%20beneficio%20y%20condiciones%20est%C3%A1n%20disponibles%3F' }
  },
  reviews: [
    { quote: 'Excelente atención y prendas con mucho estilo.', name: 'Valentina R.', image: '/assets/testimonio-1.png' },
    { quote: 'Llegó rápido y la calidad superó mis expectativas.', name: 'Carlos M.', image: '/assets/testimonio-2.png' },
    { quote: 'Me encantó la experiencia, volvería a comprar sin dudarlo.', name: 'Andrea P.', image: '/assets/testimonio-3.png' }
  ],
  colors: { background: '#080808', accent: '#dfbd72', text: '#f8f8f8' }
};

const isPlain = value => value && typeof value === 'object' && !Array.isArray(value);
const isMedia = value => typeof value === 'string' && /^\/(?:assets|media)\/[a-zA-Z0-9/_.,-]+$/.test(value) && !value.split('/').some(part => part === '..' || part === '.') && value.length <= 250;
const isLink = value => {
  if (typeof value !== 'string' || value.length > 1200) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
};
const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

export function validateConfig(value) {
  if (!isPlain(value) || !isPlain(value.brand) || !isPlain(value.offer) || !isPlain(value.links) ||
      !isPlain(value.colors) || !Array.isArray(value.reviews) || value.reviews.length !== 3) return false;
  for (const [key, max] of Object.entries({ slogan: 100 })) if (!isText(value.brand[key], max)) return false;
  for (const key of ['logo', 'heroVideo', 'heroPoster', 'footerImage']) if (!isMedia(value.brand[key])) return false;
  for (const [key, max] of Object.entries({ label: 40, title: 60, description: 80, modalTitle: 120, modalDescription: 500, buttonLabel: 100 })) if (!isText(value.offer[key], max)) return false;
  for (const key of ['tiktok', 'catalog', 'whatsapp', 'instagram', 'bonusWhatsapp']) {
    if (!isPlain(value.links[key]) || !isLink(value.links[key].url)) return false;
    if (key !== 'bonusWhatsapp' && !isText(value.links[key].label, 50)) return false;
  }
  for (const review of value.reviews) if (!isPlain(review) || !isText(review.quote, 250) || !isText(review.name, 80) || !isMedia(review.image)) return false;
  for (const key of ['background', 'accent', 'text']) if (!/^#[0-9a-fA-F]{6}$/.test(value.colors[key] || '')) return false;
  return JSON.stringify(value).length <= 12000;
}

export async function readSiteConfig(db) {
  const row = await db.prepare('SELECT draft_json,published_json,draft_revision,published_revision,updated_at,published_at FROM site_config WHERE id = 1').first();
  return row ? {
    draft: JSON.parse(row.draft_json), published: JSON.parse(row.published_json),
    draftRevision: row.draft_revision, publishedRevision: row.published_revision,
    updatedAt: row.updated_at, publishedAt: row.published_at
  } : { draft: structuredClone(defaultConfig), published: structuredClone(defaultConfig), draftRevision: 0, publishedRevision: 0, updatedAt: null, publishedAt: null };
}
