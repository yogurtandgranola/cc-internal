# Cornell Communities OS (CCOS)

A private, invitation-only operating portal for Acquisitions, Operations, Investor Relations, and Executive oversight. It is a control plane over the systems you already use (Asana, Rent Manager, Notion, Drive). It does not replace them, and in v1 it is read-only toward all of them.

**Status: working local demo with synthetic data. Not deployed. No live integration is connected.** See `docs/IMPLEMENTATION_STATUS.md` and `docs/connection-status.md` for exactly what is real.

## Quickstart (demo)

Requirements: Node 22+, and for the database tests, Postgres 15+ server binaries.

```bash
cd ccos
npm install
cp .env.example .env.local      # optional, defaults work for demo
npm run dev                     # http://localhost:3000
```

Sign in with any demo account. Password for all of them: `demo-password`.

| Email | Role | What to try |
|---|---|---|
| founder@demo.example | owner_admin | Everything: four areas, Admin, audit history |
| ops@demo.example | ops_manager | Operations, tenant-detail access, no IR |
| opsstaff@demo.example | ops_staff | Property KPIs, blocked from IR by URL, API, search, AI |
| acq@demo.example | acquisitions_manager | Deals with financials |
| ir@demo.example | ir_manager | Investors, blocked from properties |
| pm@demo.example | external_pm | Exactly one property (Demo Cedar Park) |

A yellow DEMO DATA banner is always shown. All names and numbers are fictional.

Mock sign-in exists for local development, tests, and an explicit **hosted demo**. In production it is refused unless `CCOS_DEMO_HOSTED=true` is set, and it is always refused when `CCOS_MODE=live` or any live source or vendor key is configured. See `docs/HANDOFF.md`.

## Walkthrough (10 minutes)

1. Sign in as the founder. Open Deals, Operations, Investor Relations, Executive, and Admin. Open Admin, Audit history.
2. Operations: open Demo Cedar Park. Each metric shows its formula, source, and as-of date. Open Demo Willow Bend and see `Unavailable` instead of zeros.
3. Admin: run the Asana fixture sync twice. Records do not duplicate. Two Asana records for Oak Ridge collapse into one deal. One look-alike name waits in the review queue for a person.
4. Admin: invite `helper@gmail.com` as `external_contractor` on `p-cedar`. Copy the link into a private window and accept. Then deactivate the account and reload. The old session is rejected immediately.
5. Sign in as `pm@demo.example`. Try `/operations/p-river`, `/api/properties/p-river`, and ask the AI analyst about River Estates. All return nothing.
6. Sign in as `opsstaff@demo.example`. Open `/investor-relations`. You get a 403 page with no data. `/api/investors` returns 403.
7. Admin: turn the AI assistant off. The dashboards keep working.

## Commands

```bash
npm run typecheck     # TypeScript strict
npm run lint          # ESLint (Next.js rules)
npm test              # Unit and integration tests (KPIs, authz, auth, sync, AI)
npm run test:db       # RLS tests against a throwaway local Postgres
PW_CHROMIUM=/path/to/chromium npm run test:e2e   # Playwright (omit PW_CHROMIUM if Playwright browsers are installed)
npm run build         # Production build
npm run check         # typecheck, lint, unit, and database tests
```

## Layout

| Path | Purpose |
|---|---|
| `app/` | Next.js App Router pages, server actions, API routes |
| `lib/authz.ts`, `lib/roles.ts` | Roles, permissions, scoped grants, `can()` |
| `lib/dal/` | Data Access Layer. The only way data reaches pages, APIs, search, and AI |
| `lib/kpi.ts` | Documented, unit-tested KPI math |
| `lib/connectors/`, `lib/sync.ts` | Read-only connector contract and idempotent sync |
| `lib/ai/` | Provider-neutral AI adapter and scoped retrieval |
| `lib/store.ts`, `lib/auth.ts` | Mock harness for users, invites, audit (dev and test only) |
| `lib/fixtures.ts` | Synthetic demo data |
| `supabase/migrations/` | Postgres schema and RLS policies for production |
| `tests/`, `e2e/` | Vitest, SQL RLS tests, Playwright |

## Limits

- Demo mode runs on an in-memory/file store, not Postgres. The Postgres schema and RLS policies are tested, but the app does not read from Supabase yet.
- Supabase Auth, live Asana, Rent Manager, Notion, Drive, and real LLM providers are not wired. See `docs/connection-status.md`.
- No email is sent. Invitation links are shown to the admin to deliver.
- A synthetic-data hosted demo runs on Vercel for feedback. No real data is deployed. See `docs/HANDOFF.md` and `docs/go-live-checklist.md`.
