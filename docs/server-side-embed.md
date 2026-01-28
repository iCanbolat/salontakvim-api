# Server-Side Embed / Proxy (Implemented Phase 1)

Goal: Eliminate client-side exposure of long-lived tokens by issuing short-lived, server-signed embed tokens and letting the loader/runtime call the widget API with that token.

## What is live now

- Backend issues and verifies short-lived embed tokens (HMAC, not JWT) with `storeId`, `slug`, `exp`.
- New endpoint: `GET /public/embed/:slug/script.js`
  - Public + rate limited; enforces the store allowed-domains list via `Origin` / `Referer`.
  - Issues a signed token and returns a JS bootstrap that injects the loader with data attributes.
- Widget public endpoints require a valid signed embed token; allowed-domain checks still apply.
- Loader (widget/public/widget-loader.js) now reads `data-token`, `data-api-base`, and `data-slug`, and passes them to the runtime; iframe mode forwards the same query params.
- Widget runtime reads `token`, `apiBase`, and `slug` from the URL (provided by the loader) and uses them for all API calls.

## How to embed (current flow)

```html
<!-- Place on merchant site -->
<script
  src="https://api.salontakvim.com/public/embed/{storeSlug}/script.js"
  data-cdn="https://cdn.salontakvim.com"
></script>
```

What the bootstrap does:

1. Validates origin against the store allowlist.
2. Generates a short-lived signed token (storeId + slug + exp).
3. Injects the loader script (from `data-cdn` or the same origin) with:
   - `data-token` (signed embed token)
   - `data-api-base` (points to the API host)
   - `data-slug` (store slug)
4. Loader initializes inline or iframe widget; all API calls include the signed token.

## Required env vars

- `EMBED_TOKEN_SECRET` (HMAC secret, required)
- `EMBED_TOKEN_TTL_SECONDS` (default 900)
- `APP_URL` (base used for defaults, e.g. https://api.salontakvim.com)
- `PUBLIC_WIDGET_API_BASE_URL` (optional override for widget API base; defaults to APP_URL)
- `WIDGET_LOADER_URL` (URL to the published loader bundle; defaults to `${APP_URL}/widget-loader.js`)

## Admin experience (to update)

- Dashboard embed code generator should switch to the new endpoint:
  - `<script src="${APP_URL}/public/embed/${store.slug}/script.js" data-cdn="${CDN_HOST}"></script>`
- All legacy publicToken management has been removed. Security is now managed via short-lived tokens and domain allowlists.

## Still to do (Phase 2)

- Publish loader bundle to CDN and set `WIDGET_LOADER_URL` to that CDN URL.
- Update admin UI and docs to surface the new snippet.
- (Optional) Add proxy-prefixed routes if we later want to fully hide public routes; current model relies on signed tokens against existing routes.
