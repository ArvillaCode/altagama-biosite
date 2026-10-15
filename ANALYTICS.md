# Medición de Altagama

## Qué se cuenta

| Evento | Significado |
|---|---|
| `page_view` | Carga visible del micrositio; no es una persona única |
| `click_whatsapp` | Clic en WhatsApp principal |
| `click_catalog` | Clic en Website / catálogo |
| `open_bonus` | Apertura del bono |
| `click_bonus_whatsapp` | Clic en WhatsApp desde el bono |
| `click_instagram` | Clic hacia Instagram |
| `click_tiktok` | Clic hacia TikTok |

Se guardan únicamente conteos por día (hora de Colombia), evento, origen, móvil/escritorio y marca de prueba. No se guardan IP, identificadores de visitantes, URLs completas, valores libres ni datos de conversaciones. No se usan cookies de analítica. La clasificación de dispositivo corresponde al ancho de pantalla al cargar la página.

El origen se toma de `utm_source`, si existe, o del dominio de procedencia: Instagram, TikTok, WhatsApp, Facebook, Google, otro o directo/no identificado. Los navegadores pueden ocultar la procedencia. No se infieren fuentes ausentes.

## Enlaces recomendados

- Instagram: `https://altagama.upfunnel.click/?utm_source=instagram`
- TikTok: `https://altagama.upfunnel.click/?utm_source=tiktok`
- WhatsApp: `https://altagama.upfunnel.click/?utm_source=whatsapp`

## Reportes privados

Los conteos se consultan mediante la conexión autenticada a Cloudflare D1 desde el chat o desde el dashboard privado `/panel/`. La entrada es `/login/`. La consulta `/panel/api/report` está protegida por Cloudflare Access y validación JWT en el servidor. No hay consulta anónima de estadísticas.

- Cuenta: `1fbed4859cc6f03d691ea813a7039210`.
- Base: `altagama-metrics`.
- ID D1: `4e9097d8-d009-4bc1-95b2-6e57e88fd388`.
- Binding de Pages en producción: `METRICS_DB`.
- Tabla: `metric_counts`.
- Filtro comercial obligatorio: `is_test = 0`.

Resumen por evento para un período, con fechas incluidas:

```sql
SELECT event, SUM(total) AS total
FROM metric_counts
WHERE is_test = 0 AND day BETWEEN ? AND ?
GROUP BY event ORDER BY total DESC;
```

Evolución por día:

```sql
SELECT day, event, SUM(total) AS total
FROM metric_counts
WHERE is_test = 0 AND day BETWEEN ? AND ?
GROUP BY day, event ORDER BY day, event;
```

Origen y dispositivo:

```sql
SELECT source, device, event, SUM(total) AS total
FROM metric_counts
WHERE is_test = 0 AND day BETWEEN ? AND ?
GROUP BY source, device, event ORDER BY total DESC;
```

No presentar clics como conversaciones o ventas, ni cargas como visitantes únicos. Los clics repetidos separados en el tiempo cuentan de nuevo; el cociente clics/cargas puede superar el 100 %. La medición depende de JavaScript, conectividad y filtros del navegador. Ignora rastreadores evidentes, automatización y la preferencia Global Privacy Control.

## Pruebas y navegación interna

- `?medicion=prueba` marca los eventos como pruebas y persiste ese modo durante la pestaña.
- `?medicion=off` desactiva la medición en esa pestaña, útil para revisar el diseño.
- `?medicion=on` vuelve a habilitarla normalmente.
- Para probar el guardado, abrir `https://altagama.upfunnel.click/?medicion=prueba&utm_source=instagram` y consultar `is_test = 1`.
- Los despliegues de vista previa `pages.dev` no se registran.

`/api/events` recibe los eventos públicos; `/panel` y sus rutas invocan middleware de autorización. Portada, login y recursos públicos permanecen estáticos gracias a `_routes.json`. Los fallos de medición nunca bloquean los enlaces ni el bono.

## Dashboard y acceso

- Login: `https://altagama.upfunnel.click/login/`.
- Entrada personalizada del panel: `https://altagama.upfunnel.click/panel/`.
- Dashboard autenticado: `https://altagama.upfunnel.click/panel/dashboard/`.
- La política Access permite únicamente el correo configurado por el propietario; no publicar la lista de correos en el repositorio.
- App Access: `eb70a79e-af2e-4124-8257-78ca5a8d7258`, organización `upfunnel.cloudflareaccess.com`.
- Variables de producción: `METRICS_ACCESS_AUD`, `METRICS_ALLOWED_EMAILS` (secreto).
- La autorización valida firma RS256, emisor, audiencia, vencimiento y correo permitido. También rechaza hostnames alternativos `pages.dev`.
- El panel actualiza cada diez segundos solo mientras esté visible. No indica usuarios conectados: son conteos diarios actualizados.
- Filtros: hoy, 7 días, 30 días o un rango de hasta 90 días. Hora de Colombia.
- Cada indicador se compara con el período inmediatamente anterior de igual duración. Cuando el valor anterior es cero, se muestra «Sin base de comparación anterior».
- El panel muestra cargas y acciones por origen, una tabla de valores diarios exactos y clics por 100 cargas. Estos cocientes no son conversiones de personas y pueden superar 100.
- «Descargar CSV» exporta únicamente los conteos del período visible, desglosados por fecha, evento, origen y dispositivo. La descarga se genera en el navegador a partir del reporte privado; no incluye pruebas.
- Las pruebas siempre quedan excluidas (`is_test = 0`).
- Los errores de conexión conservan la última lectura y muestran aviso; al vencer el acceso se limpian los datos visibles.
- El login del código se completa en Cloudflare Access. El sitio no recibe ni almacena contraseñas ni códigos.
- La salida mediante `/cdn-cgi/access/logout` cierra la sesión de Access.
- Cloudflare Access protege `/panel/dashboard` y `/panel/api/*`; la entrada de `/panel/` es pública y no muestra datos.

## Compilación

`npm ci && npm run build` prepara `dist/` con los archivos estáticos. Los módulos de servidor permanecen en `functions/` y `lib/`; nunca se copian al directorio público. Cloudflare Pages: build `npm run build`, salida `dist`, raíz `/`. Dependencia de verificación JWT: `jose`, fijada en `package-lock.json`.

Pruebas completas: `npm test`.

Pruebas de validación del receptor: `node --test tests/metrics.test.mjs`.
