# ALTAGAMA Store — Bio.site

Micrositio urbano premium para ALTAGAMA Store, Cartagena, Colombia.

- Sitio: https://altagama.upfunnel.click
- Cloudflare Pages: https://altagama-biosite.pages.dev
- Rama de despliegue: main
- Artefacto web: index.html (estático)
- Medición propia: `assets/analytics.js` + Pages Function `/api/events` + D1 `altagama-metrics`. Instrucciones y consultas en [ANALYTICS.md](ANALYTICS.md).

## Estado
Página nativa en HTML/CSS para móvil y escritorio, con el video MP4 proporcionado por el usuario en loop detrás del logo. El video es silencioso, se puede pausar y respeta la preferencia de movimiento reducido. Iconos SVG de WhatsApp, Instagram y TikTok de Font Awesome Free (CC BY 4.0; avisos de licencia en los SVG). Escena inferior limpia sin retratos incrustados.

El dominio requiere la excepción de Workers `altagama.upfunnel.click/*` sin script asignado, para evitar que la ruta general `*.upfunnel.click/*` lo envíe a `redirect-worker` y devuelva 404. Esta excepción ya está creada en Cloudflare.

## Pendientes antes de uso comercial
- WhatsApp confirmado: +57 319 464 5901.
- Confirmar monto y condiciones del bono de primera compra.
- Sustituir los testimonios ilustrativos por reseñas auténticas y autorizadas.
- Confirmar derechos de uso de imágenes y productos de terceros.
