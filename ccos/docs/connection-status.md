# Connection status

Last verified: 2026-11-10, in the build environment. "Verified" means exercised by a test in this repo. Nothing here talks to a live external system.

## Integrations

| System | v1 role | Status | Evidence |
|---|---|---|---|
| Asana | Canonical tasks and deal CRM | Fixture adapter only. Live adapter not written, no token supplied | `lib/connectors/asana-fixture.ts`, `tests/sync.test.ts`, e2e sync test |
| Rent Manager | Canonical rent roll and accounting | Not connected. Stub reports `not_configured`. Demo metrics are synthetic fixtures | `lib/connectors/rentmanager.ts` |
| Notion | SOPs, plans | Not connected. Links only, and one fixture document used to test prompt injection | `lib/fixtures.ts` |
| Google Drive | Source documents | Not connected. Links only | none |
| Gmail, GHL, Meow | Optional later | Not connected, not started | none |
| Supabase Auth | Production sign-in | Built and tested with a fake Supabase and a real local Postgres. Not yet tested against the real project. Passwords are checked by Supabase. Roles come from our tables on every request. Owner set by `CCOS_OWNER_EMAIL`. See `docs/first-owner-setup.md` | `tests/live-auth.test.ts`, `lib/live-auth.ts` |
| Supabase Postgres | Production data store | Project installed through Vercel on 2026-11-11 (free plan) and linked to the site for preview and production. The production build applies `supabase/migrations` through `scripts/migrate.mjs` (production builds only, never previews). Schema and RLS are tested on a local Postgres 16. The app does not read from it yet | `supabase/migrations`, `tests/db/rls.test.sql` |
| AI providers | Optional analyst | Mock provider tested. OpenAI, Anthropic, Google adapters are registered stubs that report unavailable | `lib/ai/provider.ts`, `tests/ai.test.ts` |

## Repositories reviewed as hints (not touched)

The brief named `yogurtandgranola/rent-manager-mcp`, `yogurtandgranola/cc-mhc-uw`, and `yogurtandgranola/personal-os`. They were not cloned or read in this build, because the session had access to only the target repository. Nothing was copied from them. Unverified assumptions:

- `rent-manager-mcp` is a candidate reference for a live Rent Manager read adapter. Review its README, security model, and licence first, and call only read methods.
- `cc-mhc-uw` is the underwriting source. Import approved output metadata only, never the Excel master.
- `personal-os` is not part of the company OS and must not be linked or copied.

## Existing code reuse

An earlier static Padcount dashboard exists in this repository's `app/` folder on `main` (Cloudflare Pages plus a KV store). It has no per-record authorization, no audit, and no database. CCOS does not reuse it, and it is left unchanged.

## Rent Manager (live occupancy)
Code is built and reads only. It fills in once the owner adds these in Vercel (Settings, Environment Variables, Production):
RENTMANAGER_BASE_URL (https://ccmhc.api.rentmanager.com), RENTMANAGER_USERNAME, RENTMANAGER_PASSWORD, RENTMANAGER_LOCATION_ID, CRON_SECRET (any long random text).
Use a Rent Manager user with read-only rights. Adding these turns the demo sign-in off, by design.
Vercel runs the refresh daily at 11:00 UTC. Shows occupied sites, total sites and occupancy per property. Collections and delinquency are not synced yet.
