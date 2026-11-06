# Cipher — website

The Cipher dashboard, marketing site, customer redemption page (`/redeem`) and docs, published at
**https://cipher.github.io** with GitHub Pages.

This repository is only the website. The API (Cloudflare Workers) and the Discord bot live in the
separate **cipher-platform** repository. The website talks to the API at `VITE_API_URL`.

## Local development

```bash
npm install
cp .env.example .env.local      # VITE_API_URL=http://localhost:8787
npm run dev                     # http://localhost:5173
```

Run the API from `cipher-platform` at the same time (`npm run dev:api:node` there). With the local API,
the login page offers a development login, so no Discord app is needed to try it.

## Publishing to GitHub Pages

1. Create a GitHub repository named **`<your-username>.github.io`** (for `https://cipher.github.io`
   the account or organization must be called `cipher`) and push this folder to it.
2. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables → New variable**:
   `CIPHER_API_URL` = your deployed API, e.g. `https://cipher-api.<subdomain>.workers.dev`.
4. **Actions → Deploy to GitHub Pages → Run workflow.**

Then make sure the API allows this origin: in `cipher-platform/apps/api/wrangler.toml`,
`WEB_ORIGIN` must be your Pages URL (e.g. `https://cipher.github.io`).

The build adds `404.html` (so links like `/app/s/...` work on Pages) and `.nojekyll`.

## Notes

* No secrets belong in this repository — everything here is public. The only setting is the API URL.
* `shared/` is a copy of the platform's shared code; see `shared/README.md` to refresh it.
