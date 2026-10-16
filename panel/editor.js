(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sections = [
    { title: 'Marca e imágenes', note: 'Cambia el logo, el fondo del video y la escena final.', fields: [
      ['brand.slogan', 'Eslogan', 'text'], ['brand.logo', 'Logo', 'image'],
      ['brand.heroPoster', 'Imagen inicial del video', 'image'], ['brand.heroVideo', 'Ruta del video de fondo', 'text'],
      ['brand.footerImage', 'Imagen inferior', 'image']
    ] },
    { title: 'Colores', note: 'Elige el fondo, el acento dorado y el texto principal.', fields: [
      ['colors.background', 'Color de fondo', 'color'], ['colors.accent', 'Color de acento', 'color'], ['colors.text', 'Color del texto', 'color']
    ] },
    { title: 'Bono de bienvenida', note: 'Edita el botón principal y el texto de su ventana.', fields: [
      ['offer.label', 'Texto destacado', 'text'], ['offer.title', 'Título del bono', 'text'],
      ['offer.description', 'Llamado a la acción', 'text'], ['offer.modalTitle', 'Título de la ventana', 'text'],
      ['offer.modalDescription', 'Descripción del bono', 'text'], ['offer.buttonLabel', 'Texto del botón de WhatsApp', 'text'],
      ['links.bonusWhatsapp.url', 'Enlace de WhatsApp del bono', 'url']
    ] },
    { title: 'Botones y enlaces', note: 'Edita el nombre y destino de los botones de contacto.', fields: [
      ['links.tiktok.label', 'Nombre de TikTok', 'text'], ['links.tiktok.url', 'Enlace de TikTok', 'url'],
      ['links.catalog.label', 'Nombre del catálogo', 'text'], ['links.catalog.url', 'Enlace del catálogo', 'url'],
      ['links.whatsapp.label', 'Nombre de WhatsApp', 'text'], ['links.whatsapp.url', 'Enlace de WhatsApp', 'url'],
      ['links.instagram.label', 'Nombre de Instagram', 'text'], ['links.instagram.url', 'Enlace de Instagram', 'url']
    ] },
    ...[0, 1, 2].map(index => ({ title: `Opinión ${index + 1}`, note: 'Usa reseñas auténticas y fotografías autorizadas antes de publicar.', fields: [
      [`reviews.${index}.quote`, 'Opinión', 'text'], [`reviews.${index}.name`, 'Nombre', 'text'], [`reviews.${index}.image`, 'Fotografía', 'image']
    ] }))
  ];
  let state, draft, dirty = false, saving = false;
  const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
  const set = (object, path, value) => { const parts = path.split('.'); const key = parts.pop(); const target = parts.reduce((value, part) => value[part], object); target[key] = value; };
  const notice = (message, error = false) => { $('editor-status').textContent = message; $('editor-status').classList.toggle('editor-error', error); };
  function updateButtons() {
    $('save-draft').disabled = !state || !dirty || saving;
    $('publish').disabled = !state || dirty || saving || state.draftRevision === state.publishedRevision;
    $('save-state').textContent = dirty ? 'Cambios sin guardar' : state?.draftRevision === state?.publishedRevision ? 'Publicado' : 'Borrador guardado';
  }
  function preview() {
    $('site-preview').contentWindow?.postMessage({ type: 'altagama-preview', config: draft }, location.origin);
  }
  function markDirty() { dirty = true; updateButtons(); preview(); }
  async function upload(file, input, progress) {
    if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      notice('Usa una imagen PNG, JPG o WebP de máximo 5 MB.', true); return;
    }
    progress.textContent = 'Subiendo imagen…';
    try {
      const response = await fetch('/panel/api/media', { method: 'POST', body: file, headers: { 'Content-Type': file.type }, credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) throw new Error('upload');
      const result = await response.json();
      input.value = result.path; set(draft, input.dataset.path, result.path); markDirty();
      progress.textContent = 'Imagen subida. Guarda el borrador para conservar el cambio.';
    } catch { progress.textContent = ''; notice('No se pudo subir la imagen. Comprueba tu sesión e inténtalo de nuevo.', true); }
  }
  function makeField([path, label, type]) {
    const wrap = document.createElement('label'); wrap.className = 'editor-field';
    const title = document.createElement('span'); title.textContent = label; wrap.append(title);
    const input = document.createElement('input'); input.dataset.path = path; input.type = type === 'image' ? 'text' : type;
    input.value = get(draft, path) || ''; input.autocomplete = 'off';
    input.addEventListener('input', () => { set(draft, path, input.value); markDirty(); });
    if (type === 'image') {
      const box = document.createElement('div'); box.className = 'image-field'; box.append(input);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'button button-small'; button.textContent = 'Subir imagen';
      const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp';
      button.addEventListener('click', () => file.click());
      const progress = document.createElement('small'); progress.className = 'upload-progress';
      file.addEventListener('change', () => { void upload(file.files?.[0], input, progress); file.value = ''; });
      box.append(button, file); wrap.append(box, progress);
    } else wrap.append(input);
    return wrap;
  }
  function buildForm() {
    const container = $('editor-fields'); container.replaceChildren();
    for (const group of sections) {
      const section = document.createElement('section'); section.className = 'editor-section';
      const heading = document.createElement('h2'); heading.textContent = group.title;
      const note = document.createElement('p'); note.textContent = group.note;
      section.append(heading, note, ...group.fields.map(makeField)); container.append(section);
    }
  }
  async function request(method, body) {
    const response = await fetch('/panel/api/site', { method, credentials: 'same-origin', cache: 'no-store', redirect: 'manual', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    if (response.type === 'opaqueredirect' || [401, 403].includes(response.status)) throw new Error('session');
    if (!response.headers.get('Content-Type')?.includes('application/json')) throw new Error('session');
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'server');
    return value;
  }
  async function save() {
    if (!dirty || saving) return;
    saving = true; updateButtons(); notice('Guardando borrador…');
    try {
      state = await request('PUT', { draft, revision: state.draftRevision });
      draft = structuredClone(state.draft); dirty = false; notice('Borrador guardado. Revisa la vista previa y publica cuando esté listo.');
    } catch (error) {
      notice(error.message === 'revision_conflict' ? 'Otra edición cambió el borrador. Recarga para revisar la versión más reciente.' :
        error.message === 'session' ? 'Tu sesión terminó. Vuelve a entrar desde /panel/.' : 'No se pudo guardar. Revisa los campos y vuelve a intentar.', true);
    } finally { saving = false; updateButtons(); }
  }
  async function publish() {
    if (!state || dirty || saving || !confirm('¿Publicar este borrador en el sitio de Altagama?')) return;
    saving = true; updateButtons(); notice('Publicando cambios…');
    try {
      state = await request('POST', { action: 'publish', revision: state.draftRevision });
      $('published-at').textContent = `Publicado ${new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(state.publishedAt))} · Colombia`;
      notice('Cambios publicados. El sitio público puede tardar unos segundos en actualizarse.');
    } catch (error) { notice(error.message === 'session' ? 'Tu sesión terminó. Vuelve a entrar desde /panel/.' : 'No se pudo publicar. Vuelve a intentar.', true); }
    finally { saving = false; updateButtons(); }
  }
  $('save-draft').addEventListener('click', () => { void save(); });
  $('publish').addEventListener('click', () => { void publish(); });
  $('preview-mobile').addEventListener('click', () => { document.querySelector('.preview-panel').classList.remove('wide'); $('preview-mobile').classList.add('active'); $('preview-desktop').classList.remove('active'); });
  $('preview-desktop').addEventListener('click', () => { document.querySelector('.preview-panel').classList.add('wide'); $('preview-desktop').classList.add('active'); $('preview-mobile').classList.remove('active'); });
  window.addEventListener('message', event => { if (event.origin === location.origin && event.source === $('site-preview').contentWindow && event.data?.type === 'altagama-preview-ready' && draft) preview(); });
  fetch('/panel/api/site', { credentials: 'same-origin', cache: 'no-store', redirect: 'manual', headers: { Accept: 'application/json' } })
    .then(async response => { if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) throw new Error('load'); return response.json(); })
    .then(value => { state = value; draft = structuredClone(value.draft); buildForm(); updateButtons(); preview(); notice('Edita los campos para preparar un borrador.');
      if (value.publishedAt) $('published-at').textContent = `Última publicación: ${new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(value.publishedAt))} · Colombia`; })
    .catch(() => notice('No se pudo abrir el editor. Vuelve a entrar desde /panel/.', true));
})();
