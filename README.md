# Cornell OS

A company-level operating system for the deal, ops, and investor relations teams. One login, different dashboards per role. Padcount (portfolio health) is the first module.

## Status

Built: role-based home page, Padcount dashboard (renewals with SOP and Asana links, business plan vs actual), shared data API on Cloudflare KV, role checks on the server, and a GitHub Actions deploy. Storage goes through `app/storage.js`, so nothing depends on one LLM or hosting provider.

Not live until you complete `docs/DEPLOY.md` (Cloudflare account, token, and the email allow-list).

## Run it

```bash
cd app && python3 -m http.server 8000
```

Open http://localhost:8000. With no backend it uses browser localStorage and shows every module.

## Layout

| Path | Purpose |
|---|---|
| `app/` | Static web app (plain HTML, CSS, JS, no build step). `index.html` is the role-based home, `padcount/` is the portfolio dashboard |
| `functions/` | Cloudflare Pages Functions: `/api/me` (who and which roles) and `/api/db/*` (shared data, role checked) |
| `docs/DEPLOY.md` | Step by step setup for hosting, login, and roles |
| `app/storage.js` | Storage adapter. Swap this file to change backends |
| `docs/requirements.md` | What the 2026-11-10 meeting asked for |
| `docs/access.md` | How to grant and revoke access per person and role |
| `docs/roadmap.md` | Build order |
| `AGENTS.md` | Instructions for any coding agent (Claude, Codex, Gemini, Cursor, humans) |

## Working on it with any LLM

Point your tool at `AGENTS.md`. It has the conventions and the rules for adding a module. No tool-specific files are required.
