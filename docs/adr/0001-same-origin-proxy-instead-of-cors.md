# ADR 0001: Same-origin reverse proxy instead of CORS

**Status:** Accepted

## Context

The API authenticates with an `HttpOnly` session cookie (`SameSite=Lax`, `Secure` in
production). The frontend and the API are separate Cloud Run services, so they have
different origins by default. A cross-origin setup would need:

- CORS with `Access-Control-Allow-Credentials: true` and an exact origin allow-list on
  the API;
- `SameSite=None` on the session cookie, which weakens CSRF protection; and
- in many browsers, third-party cookie restrictions that can break login altogether.

## Decision

The browser only ever talks to **one origin**. The frontend container (nginx) serves the
static app and proxies `/api/*` to the API, whose URL comes from `API_UPSTREAM` at
container start (an `envsubst` template). In development, Vite's dev server proxies
`/api` the same way.

The frontend code always calls relative `/api/...` URLs with `credentials: "include"`.

## Consequences

- No CORS configuration exists anywhere, so there is no allow-list to get wrong.
- The cookie stays first-party and can keep `SameSite=Lax`. Cross-site POSTs don't carry
  it.
- One CSP (`connect-src 'self'`) covers every request the app makes.
- The proxy adds one hop, which is negligible on Cloud Run in the same region.
- nginx must forward `X-Forwarded-For` so the API can apply its per-IP limits.
- The API must also be reachable by the frontend service. For a public demo it is
  public; in a private setup it could require an identity token added by the proxy.
