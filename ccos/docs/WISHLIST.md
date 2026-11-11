# Cornell Communities OS: feature wishlist

Purpose: a complete, prioritized list of what to build or improve next, including who can see and do what. Written to be handed to another AI model or developer.

Read first: `ccos/docs/HANDOFF.md`, `ccos/AGENTS.md`, `ccos/docs/IMPLEMENTATION_STATUS.md`. Do not break the rules in section 0.

Sources: the 2026-11-10 meeting between Leo and Loren (Fieldy recording), the original build brief, the current app, and gaps found while building. Items marked **(confirm)** are assumptions that the owner must confirm before they are built.

---

## 0. Non-negotiable rules (apply to every item)
1. Default deny. Authorization lives in `lib/dal` and in Postgres RLS, never only in the UI.
2. Read-only toward Asana, Rent Manager, Notion, Drive, Meow, Gmail until a specific write workflow is approved, audited, and tested.
3. Missing data shows `Unavailable` with a reason. Never zero. Never invented.
4. Every number shows unit, period, source, and as-of date.
5. Never merge two records by name. Only an explicit key auto-links. A person resolves the rest.
6. Synthetic demo data is always labeled and never mixed with live data.
7. No secrets, tenant data, investor data, or real financials in git, logs, or AI prompts.
8. Every feature ships with tests, and the claim "works" needs a test or a real check.
9. Plain words, short sentences. The owner is not technical.

## 1. What exists today (so nothing is rebuilt by mistake)
Roles and scoped grants, one permission-checked data layer, Postgres policies (tested), pages for Home, Deals, Operations, Investor Relations, Executive, My work, Search, Admin, AI analyst, a synthetic-data hosted demo, the Cornell brand theme, CI, and a handoff doc. Not built: live data, real sign-in, MFA, email, reminders, most scorecard measures.

---

## 2. People and permissions (the part to get right first)

### 2.1 Role catalog
Existing roles are in `ccos/docs/role-permission-matrix.md`. Proposed additions are marked NEW.

| Role | Who it is for | Sees | Can change |
|---|---|---|---|
| owner_admin | Leo | Everything, audit, admin | Users, grants, settings, integrations |
| ops_manager | Loren | All properties, financials, tenant-detail links, scorecards, renewals | Local notes, assignments, exceptions (not source systems) |
| ops_staff | Ops team, bookkeeping support | Property KPIs, tasks, renewals. No tenant detail | Local notes |
| acquisitions_manager | Dominic | All deals with financials, underwriting links | Local notes, decisions (pass or discard) |
| acquisitions_staff | Deal analysts | Deal pipeline without prices | Local notes |
| ir_manager, ir_staff | Investor team | Investor relationships, commitments, deliverables | Local notes |
| external_pm | Third-party property managers | Only their assigned property or properties | Their own checklist items and replies |
| external_contractor | VAs, consultants | Only what a scope grants, summary fields only | Nothing |
| restricted_viewer | Anyone needing a peek | Summary fields in scope | Nothing |
| bookkeeper NEW | In-house or outside accountant | Property P&L, reconciliation exceptions, payables. No tenant or investor data | Reconciliation notes |
| lender_viewer NEW | Lenders and brokers | A packaged, time-limited loan view for named properties or deals | Nothing |
| board_viewer NEW | Partners or advisors | Executive briefing and portfolio totals. No investor PII, no tenant data | Nothing |
| va_ops NEW | Virtual assistants | Task and SOP views for assigned properties. No financials | Task completion notes |
| compliance_reviewer NEW | Legal or compliance | Renewals, licenses, entity filings, notices (read) | Compliance notes |

### 2.2 Proposed starting assignments (confirm) 
Taken from the meeting. Names are assumptions until the owner confirms them.
- Leo: owner_admin
- Loren: ops_manager, portfolio-wide
- Dominic: acquisitions_manager
- Chelsea (Rent Manager data support): ops_staff or bookkeeper
- Vicky (bookkeeping) and the outside accounting firm contacts: bookkeeper, read only
- Property managers (Jackson's parks, Blank Family, IDPM, Open Management): external_pm, one grant per assigned property
- Investor team lead: ir_manager

### 2.3 Permission features to build
P0
- **Access matrix screen.** One page: people down the side, areas and properties across the top, view and edit rights in each cell. Edit from here. Show who can see what in plain words.
- **Invite flow with email.** Send the invitation from an approved sender, with expiry and resend. Accept, set password, set up MFA.
- **Real sign-in and MFA** (Supabase Auth). Required for owner_admin, ops_manager, ir_manager, and bookkeeper. Optional for external roles.
- **Scope pickers.** Choose a property, deal, entity, or department from lists, not by typing ids.
- **Field-level visibility.** Hide money fields, contact details, and notes by permission. Show "Restricted" so people know something is hidden.
- **Immediate revoke.** Deactivation kills sessions and API tokens instantly (exists in the demo, re-test on Supabase).

P1
- **"View as" for admins.** Owner sees the portal exactly as Loren, a PM, or a VA sees it, to check access. Read-only, logged.
- **Time-limited access.** Contractors and lenders get an end date. Access expires by itself with a warning email.
- **Quarterly access review.** A report of every active user, role, scope, and last login. Owner confirms or removes each.
- **Permission change requests.** A manager asks for access for someone, the owner approves, the audit log records both.
- **Two-person approval** for granting owner access or any export of investor data.
- **Per-property PM view.** Each outside PM gets a focused page: their collections, move-ins, open work orders, upcoming renewals, and what is expected of them this month.
- **Login history and alerts.** New device or location emails the owner for admin accounts.

P2
- **Group-based grants** (for example "All Kansas parks"). Grants follow park membership as parks are added or sold.
- **Delegation.** Loren can pre-approve a VA for her own parks without bothering the owner.
- **SSO option** later, only if the company adopts it. No dependency on a company email address, because external people need access without a paid seat.
- **Export controls.** Every CSV and PDF export is logged with who, what, and when. Investor and tenant exports need a reason.

### 2.4 Permission tests to require
Ops cannot reach investor data by URL, API, search, export, or AI. IR cannot reach property or tenant data. An external PM sees only their property even with forged ids. Revoked users get 401 on the next request. No one can raise their own access. These exist today. Extend them for every new role and screen.

---

## 3. Data connections (turns the demo into the real thing)
P0
1. **Supabase** as the database and sign-in. Replace the mock store. Re-run the policy tests on the real project.
2. **Asana (read-only).** Deal Flow CRM `1210103657050285`, Ops `1212008883960421`, Investor Team `1212599842540169`. Cache tasks, assignees, due dates, status. Never duplicate Asana as a task system.
3. **Rent Manager (read-only), two pilot parks:** Lincoln Park and Emporia. Pull occupancy, charges, payments, delinquencies, rent roll aggregates. Check `yogurtandgranola/rent-manager-mcp` first, read methods only.
4. **Lease date reconciliation.** Dates in Rent Manager do not match signed leases. Show a reconciliation worklist and block the renewal schedule until a lease is verified. Leases are the source of truth.

P1
5. **Notion.** Link property manuals, SOPs, and business plans. Show links first, copy content only if needed.
6. **Google Drive.** Permission-checked links to insurance policies, leases, loan documents. Hide a link from anyone who lacks Drive access.
7. **Underwriting (`cc-mhc-uw`).** Import approved summary outputs with file name, version, and date. Never touch the Excel master.
8. **Meow (read-only).** Balances and transactions for a liquidity watch, behind its own permission.
9. **Fieldy meeting transcripts.** Turn recorded meetings into suggested action items and decisions, shown for approval before anything is saved.

P2
10. **Gmail and calendar** for lead and investor touchpoints, read-only.
11. **GoHighLevel or CRM** if used for investor or lead follow-up. Inspect the real source before designing a schema.
12. **Sync health page.** Last success, records fetched, errors, stale warnings, and a retry button, for each connector.

---

## 4. Operations (Loren and the property managers)
P0
- **Portfolio table with real numbers**, each with source and as-of date.
- **Collections scorecard.** Current-period collections, 95% passes, 90% to 95% watch, below 90% red. Separate prior-period recovery, credits, prepayments, and deposits.
- **Renewals register** (insurance, property tax, entity and LLC filings, loans, vendor contracts, leases, permits). Source date, document link, owner, SOP link. Unknown dates flagged for verification.
- **Reminders by email** to the ops team at 120, 90, 60, 45, 30 days by type. Insurance renewal triggers a rebid checklist with a Notion SOP link.
- **Business plan vs actual** for every property. Approved plan version, target by year, physical milestones, and pro forma vs actual. Show missing plans clearly.
- **Exceptions inbox** with owner, next action, target date, blocker, evidence, and the source task.

P1
- **Property manager scorecards.** Collections, occupancy, net move-ins, past due, work-order age, reporting accuracy, preventable compliance errors. Separate what the PM controls from owner, cash, and vendor constraints. Thresholds beyond collections are proposed until approved.
- **Delinquency workbench.** Aging buckets, legal status, 14-day notice tracking, next step and owner. Example: a tenant with four homes in default needs a single case view.
- **Rent increase planner.** Per park: current rent, proposed increase, tenant count affected, local comps, and the regulatory path (for example the park's commission rules). Record decisions and outcomes. No automatic notices.
- **Utility billback tracker.** Water, sewer, trash, pass-through amounts by park and month.
- **Insurance dashboard.** Current premium, renewal date, last year's premium, quote comparison, and the monthly-payment premium. Home insurance question flagged for decision.
- **Infill pipeline.** Opportunity, economics, approval, financing, home order, permitting, pad prep, delivery, setup, QC, marketing, lease or sale, stabilized. Baseline, forecast, and actual dates, budget vs spend, risks, and QC photos.
- **Leasing and marketplace leads.** Lead counts and response times per park. Qualification by phone, not a long form.
- **Compliance calendar.** Licenses, inspections, security-deposit rules, state-specific requirements.
- **Move-outs and balances.** A weekly list of move-outs with any balance left behind.

P2
- Capex planner and approvals. Vendor directory and spend. Work-order trends. Seasonal view (for example winter leasing drops). Park-level notes timeline, like the property journals in Drive.

---

## 5. Acquisitions (Dominic)
P0
- **Pipeline** (table and board) with duplicate source records collapsed. Fields for stage, state, lots, POH, TOH, RTO, occupancy, price, NOI, cap, utility type, source and broker, owner, last contact, next action.
- **Screening rules, editable by admin.** Default: 50 or more lots in one park, exclude lagoon and WWTP, flag private septic. Show the reason a deal fails.
- **Diligence and financing tracker.** Deadlines, lender, estoppels, appraisal, title, blockers, and a "closing at risk" flag.

P1
- **Underwriting link** with version and date, and a view of key outputs only.
- **Pass and discard log** with reasons, so repeat sellers and brokers are tracked.
- **Broker and seller CRM-lite.** Last touch, deals sent, hit rate.
- **Portfolio deals handled correctly.** Per-park lot counts and a warning when they are unverified.
- **Lead follow-up automation (drafts only).** Suggested next message for each stale deal, queued for approval.
- **Market comps and demographics** snapshots per deal, with sources.

P2
- Offer and LOI generator drafts. Scenario comparison across deals. Pipeline conversion and cycle-time analytics.

---

## 6. Investor Relations (internal only)
P0
- **Relationship list** with last touch, next touchpoint, owner, and stage.
- **Commitments by kind:** soft, signed, collected, shown separately. A bank deposit is not proof of commitment without an approved mapping.
- **Deliverables tracker:** updates, K-1s, reports, distribution dates, with source and owner.

P1
- **Raise tracker:** target, soft, signed, collected by deal. Needs an approved target.
- **Update drafts** from approved performance data, queued for review. Never sent by the portal.
- **Investor-safe summaries.** Aggregated numbers for the team without investor names, for people who should not see PII.
- **Reporting records** for each investor package (what was sent, when, which version).

Out of scope for now: an investor-facing portal, payments, and distributions through the app.

---

## 7. Executive view (Leo)
P0
- **One-screen briefing:** top exceptions by severity and value at risk, decisions waiting, deadlines for 14, 30, and 90 days, deal exposure, collections and occupancy trend.
- **Owned assets and deals kept separate** so values are never added together by mistake.

P1
- **Liquidity watch** from authorized bank data. Cash, upcoming debt service, tax and insurance payments, and a cash runway estimate.
- **Decision log.** Each decision, who made it, why, and what happened. Blocked decisions highlighted.
- **Portfolio value view.** NOI (TTM and annualized T1, labeled), cap rate, value, and debt, with clear caveats.
- **Weekly briefing email** to the owner, generated from the same data, for review.

P2
- Scenario tools (refinance or sale). Board pack export. Quarter-over-quarter comparison.

---

## 8. AI analyst
P0
- Keep it read-only, scoped to the asking user, with sources, as-of dates, and gaps stated.
- Real provider adapters behind the existing interface (OpenAI, Anthropic, Google), chosen by an admin allow-list. A provider change must never change what data is visible.
- **No tenant or investor data to a provider** until the owner approves, with redaction for prompts.
- Usage limits, cost tracking, and an admin off switch (exist, keep).

P1
- **Evals:** a fixed set of questions with expected answers, run on every provider change. Include prompt-injection and permission-leak cases.
- **Proactive suggestions (approval only).** "Roberto asked about a transaction. Here is the context." The user approves before anything is saved. No automatic sends.
- **Meeting-to-actions.** From a transcript, propose tasks, owners, and dates for review.
- **Saved questions** per role (for example "which parks are under 95%").
- **Explain this number.** Click any metric to see the formula, inputs, and sources in plain language.

P2
- A separate, authenticated MCP server exposing least-privilege read tools to outside assistants, with OAuth, rate limits, and logs.

---

## 9. Platform and quality
P0
- **Email sending** from an approved sender for invites, reminders, and digests.
- **Notifications center** in the app, with per-user settings.
- **Monitoring and error tracking,** uptime check, and alerts to the owner.
- **Backups and restore test** for the database.
- **Staging and production** environments, with the demo kept separate from real data.
- **Fix the sign-in banner wording** on the hosted demo ("for local testing only" is wrong there).

P1
- **In-app feedback button** on every page that creates a GitHub issue or a task, with page, role, and a screenshot option. Needed because Loren and others will test it.
- **Saved views and filters.** Per user, shareable by role.
- **Comments and watch items.** Local notes on a property, deal, or exception, visible by permission, with @mentions.
- **Better search.** Typo tolerance, recent items, and filters. Still scoped before matching.
- **Exports and print packs.** Lender package, monthly owner report, and PM scorecard PDF, with logo and brand.
- **Performance budget.** Pages load in under 2 seconds on a normal connection. Track it in CI.
- **Mobile polish.** Key screens usable on a phone: my work, exceptions, a property card, approvals.
- **Audit export** and retention rules.
- **Dependency updates and security review** on a schedule.

P2
- Offline-friendly property checklist for field visits. Dark mode refinement. Multi-language labels. Admin analytics on which screens people use.

---

## 10. Design and usability
- Keep the Cornell brand: forest `#003208`, gold `#C8A456` as the single action color with forest text, cream `#F4EFE6`, DM Sans, DM Mono, Abril Fatface. Gold never as text on cream or white.
- A role-based home page for each person, with the three things they need first.
- Onboarding tour for new users by role, and a "what can I see and why" explainer.
- Consistent empty, loading, stale, disconnected, and unauthorized states that say what is true and how to recover.
- Accessibility: keep the axe scan clean, keyboard navigation, labels, contrast, focus.
- Plain language everywhere. No jargon without a tooltip.

---

## 11. Suggested build order
1. Supabase sign-in, access matrix, invite email, MFA (section 2 P0, section 3 item 1).
2. Asana read-only, then Rent Manager for Lincoln Park and Emporia (section 3 P0).
3. Real collections and renewals with reminders, plus lease reconciliation (section 4 P0).
4. Feedback button and staging environment, so testers can help (section 9).
5. PM scorecards and per-property PM view (sections 2 P1 and 4 P1).
6. Deals tracker on live Asana data (section 5).
7. IR deliverables and commitments (section 6).
8. Executive briefing with liquidity (section 7).
9. AI evals and real provider adapter, after the data-sharing decision (section 8).

## 12. Decisions the owner must make before building
1. Which Asana projects and Rent Manager properties come first.
2. The final list of people, roles, and scopes (section 2.2).
3. Supabase and Vercel approval, domain `os.cornellcommunities.com`, and who pays.
4. Scorecard thresholds beyond collections.
5. Whether any tenant or investor data may go to an AI provider.
6. Which email sender to use for invites and reminders.
7. Whether outside PMs and lenders get logins or only packaged reports.
8. Whether investor-facing access is ever wanted.

## 13. Prompt to give the next model
> Read `ccos/docs/WISHLIST.md`, `ccos/docs/HANDOFF.md`, `ccos/AGENTS.md`, and `ccos/docs/IMPLEMENTATION_STATUS.md` in https://github.com/yogurtandgranola/cc-internal. The owner is not technical, so explain in plain words and do the work yourself. Follow section 0 of the wishlist without exception. Start with section 11, step 1. Before building, list what you will build, what you need from the owner, and how you will test it. Open one pull request per step. Report test results exactly, and say what was not tested.
