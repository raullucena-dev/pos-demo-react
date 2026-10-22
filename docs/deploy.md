# Deploying to Cloud Run

The frontend is a static build served by **nginx** in a container. nginx also proxies
`/api/*` to the API service, so the browser only ever sees one origin (see
[ADR 0001](adr/0001-same-origin-proxy-instead-of-cors.md)). Deploy the API first by
following [its guide](https://github.com/raullucena-dev/fastapi-multitenant-rls/blob/main/docs/deploy.md).

Placeholders: `PROJECT_ID`, `REGION=us-east1`.

```bash
export PROJECT_ID=raul-portfolio-demo
export REGION=us-east1
export REPO=portfolio
export IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/pos-demo-react"
export TAG=$(git rev-parse --short HEAD)
gcloud config set project "$PROJECT_ID"

# URL of the API service deployed from fastapi-multitenant-rls
export API_URL=$(gcloud run services describe pos-api --region "$REGION" --format 'value(status.url)')
```

## Build and deploy

```bash
gcloud builds submit --tag "$IMAGE:$TAG"

gcloud run deploy pos-web \
  --image "$IMAGE:$TAG" --region "$REGION" \
  --set-env-vars "API_UPSTREAM=$API_URL" \
  --cpu 1 --memory 256Mi --concurrency 80 \
  --min-instances 0 --max-instances 2 \
  --allow-unauthenticated

gcloud run services describe pos-web --region "$REGION" --format 'value(status.url)'
```

- Cloud Run injects `PORT`; the nginx template listens on it. The image defaults to 8080.
- `API_UPSTREAM` is substituted into the nginx config when the container starts, so the
  same image works against any API URL. It must be the full origin without a trailing
  slash, for example `https://pos-api-abc123-ue.a.run.app`.
- The API is reached over HTTPS with SNI (`proxy_ssl_server_name on`) and the upstream's
  own `Host`, which Cloud Run requires for routing.

## What the container does

| Path            | Behaviour                                                                            |
| --------------- | ------------------------------------------------------------------------------------ |
| `/api/*`        | Proxied to `API_UPSTREAM` with the `/api` prefix removed; forwards `X-Forwarded-For` |
| `/assets/*`     | Hashed files, `Cache-Control: public, max-age=31536000, immutable`                   |
| everything else | SPA fallback to `index.html`, `Cache-Control: no-cache`                              |
| `/healthz`      | Liveness endpoint for the container                                                  |

Every response carries security headers: a strict CSP (`script-src 'self'`, no inline
scripts or styles), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
`Permissions-Policy`, COOP and HSTS. gzip is enabled for text assets. nginx runs as a
non-root user (`nginx-unprivileged`).

## Verify

```bash
export WEB_URL=$(gcloud run services describe pos-web --region "$REGION" --format 'value(status.url)')
curl -fsSI "$WEB_URL/" | grep -i content-security-policy
curl -fsS "$WEB_URL/api/health"          # proxied to the API
curl -fsS "$WEB_URL/api/demo/info"       # demo credentials
```

Then open `$WEB_URL`, log into each store and check that neither store ever shows the
other's data.

## Local runs

| Goal                         | Command                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UI against a local API       | Start the API with `make up && make reset-demo` in fastapi-multitenant-rls, then `pnpm dev` here (Vite proxies `/api` to `http://localhost:8000`, or to `API_UPSTREAM` if set) |
| UI without any backend       | `pnpm dev:mock`, which runs MSW in the browser as the API                                                                                                                      |
| Production container locally | `docker build -t pos-web . && docker run --rm -p 8080:8080 -e API_UPSTREAM=http://host.docker.internal:8000 pos-web`                                                           |
