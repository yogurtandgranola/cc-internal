# Deploy and manage access

Everything below needs an account only you control. Total time: about 15 minutes. All code and config is already in this repo.

## 1. Create the Cloudflare project (free plan)
1. Sign in at https://dash.cloudflare.com and note your Account ID (right sidebar of the home page).
2. Create an API token: My Profile, API Tokens, Create Token, "Edit Cloudflare Workers" template, plus the permission `Account > Cloudflare Pages > Edit` and `Account > Workers KV Storage > Edit`.
3. Create the data store (run once from any machine with Node, or use Dashboard, Workers KV, Create namespace named `cornell-os-db`):
   ```bash
   npx wrangler kv namespace create cornell-os-db
   ```
   Paste the returned id into `wrangler.toml` in place of `REPLACE_WITH_KV_NAMESPACE_ID`.

## 2. Connect GitHub to Cloudflare deploys
In this GitHub repo, Settings, Secrets and variables, Actions:
- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Variable: `DEPLOY_ENABLED` = `true`

Push to `main` (or run the Deploy workflow) and the site publishes to `https://cornell-os.pages.dev`.

## 3. Add the login (Cloudflare Access)
1. Cloudflare dashboard, Zero Trust, Access, Applications, Add, Self-hosted.
2. Application domain: `cornell-os.pages.dev`. Also add any custom domain you attach later, and `*.cornell-os.pages.dev` so preview URLs are covered.
3. Policy: Action Allow, Include: Emails. List every person who may log in (Gmail is fine). Login method: One-time PIN. The free plan covers 50 users.

To add or remove someone, edit that email list. To cut off a person completely, remove them here.

## 4. Assign roles (what each person sees)
Pages project, Settings, Variables and Secrets, add a secret named `ROLES`:
```json
{"leo@example.com":["admin"],"loren@example.com":["ops"],"dominic@example.com":["deals"]}
```
Roles: `admin` (everything, can edit), `ops` (Padcount, can edit), `deals`, `ir` (view only). Policy lives in `functions/_lib.js`. Someone who passes Access but has no role sees an empty home page and gets 403 from the data API.

## Local development
```bash
cd app && python3 -m http.server 8000      # UI only, uses localStorage
npx wrangler pages dev app --kv DB          # full stack, set DEV_EMAIL and ROLES in .dev.vars
```

## Known limits
- Data store is one KV key per collection. Two people saving at the same instant, the last write wins. Fine for a small team. Move to Supabase or D1 by writing a new adapter in `app/storage.js` and new functions.
- The dashboard refreshes every 15 seconds, not instantly.
- Renewal reminder emails are not built yet. They need a scheduled Worker plus an email sender (Resend or similar) and an API key.
