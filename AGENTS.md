# Agent instructions

Applies to any coding agent or human contributor.

## Principles
- Vendor neutral. No code may call a specific LLM or hosting API directly. Use adapters (`app/storage.js`).
- No build step until one is clearly needed. Plain HTML, CSS, JS.
- Never commit secrets, tenant data, or financials. Real data lives in the backend, not in git. `data/` is gitignored.
- Treat all stored text as untrusted. Set it with `textContent`, never interpolate into `innerHTML`.
- Light and dark themes both work. Colors are CSS variables on `:root`.

## Adding a module
1. Create `app/<module>/index.html`, reuse the CSS variables from `app/index.html`.
2. Declare which roles may see it in `app/modules.json` (roles: `ops`, `deals`, `ir`, `admin`).
3. Read and write data only through `window.CornellStorage.use("db")`.
4. Add a short section to `docs/requirements.md` naming the source of each number (Rent Manager, Asana, Notion, Drive, Meow).

## Style
Short sentences, plain words. No em dashes.
