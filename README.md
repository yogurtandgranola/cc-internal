# Cornell OS

A company-level operating system for the deal, ops, and investor relations teams. One login, different dashboards per role. Padcount (portfolio health) is the first module.

## Status

v0 is the Padcount portfolio dashboard, copied from Loren's version and made vendor-neutral. Data storage goes through `app/storage.js`, so the app does not depend on any one LLM or hosting provider.

## Run it

```bash
cd app && python3 -m http.server 8000
```

Open http://localhost:8000. With no backend configured it uses browser localStorage.

## Layout

| Path | Purpose |
|---|---|
| `app/` | Static web app (plain HTML, CSS, JS, no build step) |
| `app/storage.js` | Storage adapter. Swap this file to change backends |
| `docs/requirements.md` | What the 2026-11-10 meeting asked for |
| `docs/access.md` | How to grant and revoke access per person and role |
| `docs/roadmap.md` | Build order |
| `AGENTS.md` | Instructions for any coding agent (Claude, Codex, Gemini, Cursor, humans) |

## Working on it with any LLM

Point your tool at `AGENTS.md`. It has the conventions and the rules for adding a module. No tool-specific files are required.
