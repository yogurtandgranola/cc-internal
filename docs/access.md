# Access model

Goal: anyone the admin designates can log in, and each person sees only the dashboards for their role. No dependence on a Cornell email address.

## Roles
`admin`, `ops`, `deals`, `ir`. A person can hold several.

## Options, ranked

1. **Cloudflare Pages plus Cloudflare Access (recommended).** Host this repo as a static site. Access gates the whole site with an email allow-list (one-time PIN to any email, including Gmail). Free up to 50 users. Add or remove people in the dashboard. Pass the verified email to the app to pick role views.
2. **Supabase (Postgres plus auth plus row level security).** Use when data needs per-role rules enforced server side, and for real shared storage. Write a `supabaseAdapter()` in `app/storage.js`.
3. **Claude artifact sharing.** Works today for a quick pilot. Share by email invite. Seat costs apply to each Claude user, which the meeting wants to avoid.

Do not use public GitHub Pages for real portfolio data. It has no login.

## Implemented
Option 1 plus server-side role checks. Cloudflare Access handles login. `functions/_lib.js` maps the verified email to roles (secret `ROLES`) and enforces who can read or write each collection. Setup steps are in `DEPLOY.md`.

## Rule
Role checks in the browser only hide menus. Anything confidential must be protected by the backend (option 1 gating plus option 2 row level security).
