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

Los conteos se consultan mediante la conexión autenticada a Cloudflare D1 desde el chat. No hay endpoint público para leer estadísticas.

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

Solo `/api/events` invoca una Pages Function; portada y recursos permanecen estáticos gracias a `_routes.json`. Los fallos de medición nunca bloquean los enlaces ni el bono.

Pruebas de validación del receptor: `node --test tests/metrics.test.mjs`.
