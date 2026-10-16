# Altagama site editor

Open `/panel/dashboard/editor/` after signing in through `/panel/`. The editor changes the current live storefront at `/`. It is limited to Altagama.

Edit a field and review the preview, then save the draft. Drafts do not change the public site. Use **Publicar cambios** to make the saved draft public. The metrics dashboard remains at `/panel/dashboard/`.

The editor controls the brand slogan, logo, video poster and video path, footer image, three colors, offer text and WhatsApp destination, four social buttons, and three illustrative reviews. Image uploads accept PNG, JPEG, or WebP up to 5 MB. Video upload is not included; its path can refer to an existing file under `/assets/` or `/media/`.

Production requirements:

- Run `migrations/0002_site_config.sql` against the existing `METRICS_DB` D1 database.
- Bind R2 bucket `altagama-site-media` to the Pages project as `SITE_MEDIA` in production and redeploy.
- Keep Cloudflare Access protecting `/panel/dashboard/*` and `/panel/api/*`.

The public `/api/site` endpoint returns only the published configuration. Uploaded image URLs are served through `/media/*`. Changes are versioned in D1 to prevent one browser tab from silently overwriting another.
