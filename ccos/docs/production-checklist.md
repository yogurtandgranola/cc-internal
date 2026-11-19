# Production checklist

Plain steps. "You" is the owner. Items marked (done) are already in place.

## Safety (done in code)
- (done) Sign-in is real. Passwords live in Supabase, roles and property access live in our database and are read on every click.
- (done) Demo accounts are off in production whenever the database is connected.
- (done) Preview deployments can never reach the real database or real sign-in.
- (done) Failed sign-ins are counted in the database: 5 wrong tries pause that email for 15 minutes, even across restarts.
- (done) Every upload, access change and sign-in is in the audit log.
- (done) Migrations run only on production builds. A failed migration keeps the last good site live.
- (done) Health check at `/api/health` for uptime monitors. It shows only ok or down.
- (done) Vercel login wall is on previews only. The real site is protected by our own sign-in.

## Needs you
1. In Supabase, turn off public sign-up (Authentication, Sign In / Providers, Email, "Allow new users to sign up" off).
2. In Supabase, check backups. The free plan has no point-in-time recovery. Paid plans do. Upgrade before trusting it with irreplaceable records.
3. Add a free uptime monitor (for example UptimeRobot) on `https://cc-internal-ten.vercel.app/api/health`, alert to your email.
4. Add `RENTMANAGER_PASSWORD` in Vercel to turn on live Rent Manager occupancy.
5. Add `ASANA_ACCESS_TOKEN` in Vercel when the Asana connection is built.
6. Give each teammate their own login in People and access. Never share one login.
7. Turn on two-step login for your own Supabase and Vercel accounts, and your GitHub account.

## Not built yet
- Two-step login inside the portal.
- Invite and password-reset emails (owner shares temporary passwords by hand).
- Asana tasks, Notion manuals, Drive journals, budgets, renewals register.
