# Go-live checklist

Nothing below has been done. Each step needs an explicit decision from the owner.

## Approvals and accounts
- [ ] Approve a Supabase project (region, plan) and a Vercel project, and who pays.
- [ ] Approve the domain `os.cornellcommunities.com` and the DNS change.
- [ ] Approve which people get access, and with which roles and scopes.

## Credentials (stored as environment secrets, never in git)
- [ ] Supabase URL, publishable key, and secret key (server only).
- [ ] Asana personal access token or OAuth app, read scope only.
- [ ] Rent Manager API access for the two pilot properties, Lincoln Park and Emporia, read only.
- [ ] Optional: AI provider key, with a data-sharing decision (no tenant or investor data goes to a provider without that decision).
- [ ] A random `CCOS_BOOTSTRAP_TOKEN` and `CCOS_SESSION_SECRET` (32+ characters).

## Engineering
- [ ] Replace the mock store and auth with Supabase Auth and the Postgres schema in `supabase/migrations`. Run `tests/db/rls.test.sql` against the real project.
- [ ] Build the first-owner setup flow and turn on MFA for the owner.
- [ ] Write the live Asana and Rent Manager adapters with the existing contract tests, and run a pilot sync on a copy.
- [ ] Add a password reset flow and email sending through an approved sender.
- [ ] Move login throttling and rate limits to a shared store.
- [ ] Run a dependency audit and an independent security review.
- [ ] Reconcile lease dates in Rent Manager against signed leases before building the renewal schedule.
- [ ] Set the `CCOS_MODE=live` flag only after live sources are connected. Until then every screen shows `Not connected`.

## Launch
- [ ] Invite the owner, then one pilot user per department, then others.
- [ ] Confirm audit history shows invites and first logins.
- [ ] Review `docs/security.md` limitations and decide what must be fixed before wider access.
