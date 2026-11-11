# Implementation status

Legend: done and tested, built but untested, blocked, not started, pending approval.

## Milestones

| Milestone | State | Notes |
|---|---|---|
| A. Foundation | Done, tested | Next.js 16 App Router, strict TypeScript, scripts, Postgres schema and RLS, seed, scoped authorization, mock auth harness |
| B. Product shell and pages | Done, tested | Login, invite acceptance, Home, Deals (table, board, detail), Operations (grid, detail, scorecard, renewals), IR, Executive, My work, Search, Admin, AI, error and empty states |
| C. Data plane | Partly done | Connector contract, Asana fixture adapter, idempotent paginated sync with checkpoint and retry, crosswalk, dedupe, review queue. No live provider |
| D. LLM portability | Done, tested with mock | Provider interface, scoped retrieval, citations, rate limit, usage log, off switch. Real vendor adapters not written |
| E. Production readiness | Partly done | CI, docs, go-live checklist. Not deployed. Supabase wiring pending |

## Feature register

| Item | State |
|---|---|
| Roles, permissions, scoped grants, default deny | Done, unit and e2e tested |
| Postgres RLS on every table, forced, anon denied | Done, 49 SQL checks on a real Postgres 16 |
| Role separation (ops, IR, external PM) across pages, APIs, search, export, AI | Done, tested |
| Invite by any email, accept, deactivate, token reuse denied | Done, tested (mock store) |
| First-owner bootstrap with operator token, single use | Function and unit tests only. No CLI or web flow yet |
| Self-elevation blocked | Done in app and in RLS, tested both |
| Two-person control for dangerous privileges | Not started. Only the owner can grant owner access |
| KPI math with unavailable states | Done, 18 unit tests |
| Pro forma vs actual, plan version, TTM vs T1 labels | Done for NOI, occupancy target. Infill budget vs spend shown |
| Renewal register with unknown-date flags | Done. Reminders at 120/90/60/45/30 are described, not sent |
| 3PM scorecard | Collections, occupancy, net move-ins. Work-order age, reporting accuracy, compliance errors not built (need data sources) |
| Business plan change history (original vs revised dates) | Baseline and forecast dates shown. No change log table yet |
| IR goals vs commitments | Commitments by kind done. Goal tracking waits on an approved target |
| Executive liquidity watch | Not started. Needs authorized bank data |
| Local comments, watch items | Not started |
| Notifications inbox | Home exception list only. No push or email |
| "Start here" home: needs action, follow up, portfolio KPIs, plan vs actual, infill budget vs spend, 90-day calendar, tool links, data-source status | Done on synthetic data, unit and e2e tested (`lib/dal/start-here.ts`). Operating budget vs actual, delinquency aging, work-order age show as Unavailable until their sources are connected |
| Universal search | Done, scoped before matching |
| CSV export | Done, scoped, formula-safe |
| MFA | Not started. Planned with Supabase Auth |
| Hosted demo mode (explicit opt-in, fail closed) | Done, unit tested and checked on a production build |
| Mobile and tablet layout | Done, overflow test at 390px |
| Accessibility | axe scan on 11 pages with no serious or critical issues, skip link, labels, focus |
| External writes of any kind | Intentionally absent |

## Pending approval (nothing done without it)

- Creating a Supabase project, a Vercel project, DNS for `os.cornellcommunities.com`
- Real credentials for Asana, Rent Manager, and AI providers
- Inviting real coworkers
- Any scheduled job with production access
