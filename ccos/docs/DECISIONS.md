# Decisions

## ADR-1: Next.js App Router with TypeScript strict
Matches the brief. Server components let the permission check run on the server before anything reaches the browser. `next build` runs in CI. Pages are dynamic and send `Cache-Control: private, no-store`.

## ADR-2: Roles plus scoped grants, permissions as the unit of checking
Roles are bundles of permissions. A grant attaches a role to a scope (org, department, property, deal, legal entity, investor). Code checks `can(user, permission, resource)`, never a role name. Roles that belong to one department (ops, acquisitions, IR) cannot reach another department even if mistakenly given org scope. External PMs and contractors have no home department, so their property scope decides.

## ADR-3: One Data Access Layer
`lib/dal` is the only path to data for pages, APIs, search, exports, and AI. It filters first, then shapes output, so counts, snippets, and error messages cannot leak. Out-of-scope ids return null and become 404.

## ADR-4: Postgres RLS is the production boundary, the DAL is the application boundary
Both express the same model. RLS functions are `security definer` with a fixed `search_path`, tables are `force row level security`, and anon has no privileges. Writes by ordinary users are not allowed except grant management and deactivation, and both block self-targeting.

## ADR-5: Mock harness instead of local Supabase
The build environment had Postgres 16 but no Docker, so local Supabase could not run. The app therefore runs on a dev-only mock store and mock auth. The SQL layer is tested separately on real Postgres with a small stand-in for `auth.uid()`. Wiring the app to Supabase is the main remaining engineering step. Mock auth is refused when `NODE_ENV=production` or `CCOS_MODE=live`.

## ADR-6: Invitation links are shown to the admin, not emailed
The brief forbids sending email without an approved workflow. Tokens are random, stored only as a SHA-256 hash, single use, and expire in 7 days.

## ADR-7: Sessions are signed cookies tied to a session version
Deactivating a user or changing their grants increments `sessionVersion`, so old tokens stop working on the next request. Login has per-email throttling and constant-work password checks (scrypt).

## ADR-8: Sync never merges by name
Only an explicit crosswalk key auto-links a source record to a canonical deal. Similar names go to a review queue where a person decides. Sync is incremental with a checkpoint, retried with backoff, and idempotent.

## ADR-9: AI is a replaceable adapter that only sees authorized context
Retrieval calls the DAL as the asking user. The provider interface takes pre-filtered context, so a provider switch cannot change visibility. Document text is wrapped as quoted untrusted data. There are no write tools. The assistant can be turned off, and dashboards do not depend on it.

## ADR-10: Metrics are null, not zero, when inputs are missing
Each KPI returns a value, unit, formula, status, and reason. The UI shows `Unavailable` with the reason. T1 annualized NOI is labeled as such and is never shown as TTM.

## ADR-11: The earlier Cloudflare static dashboard is kept, not reused
It has no per-record authorization or audit and keeps data in one KV key. It stays on `main` unchanged.
