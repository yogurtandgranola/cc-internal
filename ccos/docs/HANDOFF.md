# Handoff: Cornell Communities OS (CCOS)

Read this first. It lets any person or AI model (Claude, Codex, Gemini, Cursor) continue the work without the earlier chat.

## What this is
A private, invitation-only operating portal for Cornell Communities (manufactured housing parks): Acquisitions, Operations, Investor Relations, and Executive views, with role-based access, KPIs with sources and as-of dates, a read-only AI analyst, and an audit trail. It is a control plane over Asana, Rent Manager, Notion, and Google Drive. It is read-only toward all of them.

The owner is not technical and does not use a terminal. Explain in plain words, give clicks not commands, and do the work yourself where possible.

## Where things are
| Thing | Location |
|---|---|
| Code | https://github.com/yogurtandgranola/cc-internal , app in `ccos/`, default branch `main` |
| Hosted demo | https://cc-internal-ten.vercel.app (Vercel team `cc-5748`, project `cc-internal`, Next.js, root directory `ccos`) |
| Older static dashboard | repo root `app/` and `functions/` (Cloudflare idea, unused). Not part of CCOS |
| Requirements source | Fieldy recording "MHP Portfolio Operations and Strategy" (2026-11-10, Leo and Loren), summarized in `docs/requirements.md` of the legacy app and in the one-shot brief |
| Brand | Drive file `cornell-communities-brand-guidelines-v3.1.html` (forest `#003208`, gold `#C8A456`, cream `#F4EFE6`, DM Sans, DM Mono, Abril Fatface). Gold is the single action color, forest text on gold, never gold text on cream or white |

## State (2026-11-11)
Merged to `main`: the full portal (PR 1), the brand theme (PR 2), and the hosted demo mode (PR 3).

Working and tested:
- Roles and scoped grants, one Data Access Layer (`lib/dal`), 404 for out-of-scope ids, Postgres RLS migrations tested on a real Postgres 16
- Pages: login, invite, Home, Deals, Operations (+ property detail), Investor Relations, Executive, My work, Search, Admin, AI analyst
- KPI library with `Unavailable` states, Asana fixture sync (idempotent, dedupe, review queue), mock AI with scoped retrieval
- Tests: unit (`npm test`), RLS (`npm run test:db`), Playwright e2e including accessibility (`npm run test:e2e`), CI on GitHub

Not connected, not built (do not claim otherwise):
- No live Asana, Rent Manager, Notion, Drive, or real LLM provider. Demo data is synthetic and labeled
- The running app uses a mock store and mock sign-in, not Supabase. No MFA, password reset, or email sending
- Hosted demo changes (invites, deactivations, settings) live in server memory and can reset or differ between server instances. Seeded accounts always work

## How the hosted demo is gated
Mock sign-in is refused in production unless `CCOS_DEMO_HOSTED=true` AND `CCOS_MODE` is not `live` AND none of these are set: `ASANA_ACCESS_TOKEN`, `RENTMANAGER_BASE_URL`, `RENTMANAGER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`. Connecting any real source turns the demo sign-in off by design. Supabase keys are the one exception for now (owner decision 2026-11-11): the Supabase project is installed through Vercel and linked to the site, but it is empty and the app does not read from it, so the demo keeps working. Put the Supabase variables back in `LIVE_SOURCE_VARS` in `lib/auth.ts` when real sign-in ships or any real record is stored there. Vercel env vars set for the demo: `CCOS_DEMO_HOSTED`, `CCOS_SESSION_SECRET`, `CCOS_DEMO_PASSWORD`, `CCOS_PERSIST`. The demo password is shared by the owner directly with testers. It is not stored in git.

## 2026-11-11 session: Start here dashboard
- Home is now "Start here" (`app/(app)/page.tsx`, data from `lib/dal/start-here.ts`, tests in `tests/start-here.test.ts`).
- Connection check from the build session (read only, no data stored in git): Rent Manager (12 properties, 11 active), Asana (workspace reachable), Notion property manuals, Drive property journals, Vercel and GitHub all answered. The hosted app itself still has no credentials, so it shows synthetic data.
- Live data in the hosted app needs Supabase sign-in first. Reason: setting any real credential turns the shared demo password off by design, and real tenant data must not sit behind a shared password. See `docs/CONTRIBUTING.md` for adding editors.
- The Rent Manager MCP server reports `Mode: read/write`. The app adapter must call read methods only.

## Decisions waiting on the owner
1. Which Asana projects and Rent Manager properties to show first (candidates: Asana `1210103657050285` Deal Flow CRM, `1212008883960421` Ops, `1212599842540169` Investor Team. Pilot properties Lincoln Park and Emporia)
2. Who gets access and at what role and scope
3. Approval to create a Supabase project and to use a real domain (`os.cornellcommunities.com`)
4. Scorecard thresholds beyond collections (95% pass, below 90% red are agreed. Others are proposed)
5. Whether any tenant or investor data may go to an AI provider (default: no)

## Next steps, in order
1. Gather feedback from Loren and testers on the hosted demo. Capture it in GitHub issues
2. Wire Supabase: replace `lib/store.ts` and `lib/auth.ts` with Supabase Auth and the schema in `supabase/migrations`. Re-run `tests/db/rls.test.sql` on the real project. Build the first-owner setup flow, MFA, password reset
3. Live Asana read adapter behind `lib/connectors/types.ts`, with the same contract tests. Set crosswalk keys so one deal is never counted twice
4. Rent Manager read adapter for two pilot properties. Check `yogurtandgranola/rent-manager-mcp` first (read methods only). Lease dates in Rent Manager do not match signed leases, so show exceptions until reconciled
5. Renewal reminders (120/90/60/45/30 days), pro forma vs actual by year, infill milestones, IR goal tracking

## Rules that must not be broken
See `ccos/AGENTS.md`. In short: default deny, read data only through `lib/dal`, no external writes in v1, missing data is `Unavailable` never zero, never merge records by name, no secrets or real data in git, and every claim of "works" needs a test or a real check.

## Practical notes learned the hard way
- Next.js 16: `cookies()`, `params`, and `searchParams` are async. Use `forbidden()` and `unauthorized()` (enabled by `authInterrupts`). Read `node_modules/next/dist/docs/` before changing framework code
- `gh pr create` fails in the cloud session (GraphQL blocked). Use the REST API: `gh api repos/yogurtandgranola/cc-internal/pulls --method POST --input file.json`
- `npm run test:db` needs Postgres server binaries. Playwright may need `PW_CHROMIUM=/path/to/chromium`
- A failed sign-in used to clear the email box (React 19 resets forms). Fixed by returning the email in action state
- Do not leave dev servers running on a port while testing. A stale server gave a false failure once

## Style for the owner's communications
Plain words, short sentences. No em dashes. No litotes. No irony. Avoid wording that reads as AI generated. Report test results exactly, and say what was not tested.

## Starter prompt to paste into a new chat
> You are continuing work on Cornell Communities OS. Read `ccos/docs/HANDOFF.md`, `ccos/AGENTS.md`, `ccos/docs/IMPLEMENTATION_STATUS.md`, and `ccos/docs/connection-status.md` in https://github.com/yogurtandgranola/cc-internal first. The owner is not technical, so explain in plain words and do the work yourself. Do not claim anything works unless a test or a real check shows it, and do not use real tenant, investor, or financial data. My priority today is: <say what you want here>.
