# KPI dictionary

Code: `lib/kpi.ts`. Tests: `tests/kpi.test.ts`. A KPI with missing inputs returns `null` with a reason. It never becomes zero.

| KPI | Formula | Notes |
|---|---|---|
| Physical occupancy | `occupied_operational_sites / total_operational_rentable_sites` | Licensed, developed, and offline sites are shown separately. Occupied above rentable is rejected as a data error |
| Current-period collections | `payments_allocated_to_charges_due_this_period / net_current_period_charges_due` | Prior-period recoveries are a separate field and never enter the numerator. Above 100% shows a warning, not a silent cap. Credits and adjustments are netted into the denominator by the source mapping, which must be documented per source |
| TTM NOI | `sum(recognized operating income) - sum(operating expense)` over the same 12 complete calendar months | Excludes debt service, capex, owner contributions. Needs all 12 months. Missing expense is never inferred. Cash vs accrual follows the source policy and must be recorded |
| T1 annualized NOI | `most recent complete month NOI * 12` | Always labeled annualized T1, never TTM, always shows a volatility warning |
| Business plan variance | `actual - approved_target` | Periods must match. The plan version and approval date are shown |
| Net move-ins | `move_ins - move_outs` over the agreed date range | Rentals and home sales should be kept separate when sources allow |
| Deal pipeline value | Sum of one declared basis (asking price or LOI price) over canonical deals | Each deal counted once, deals without that basis are excluded and counted, bases are never mixed |
| IR commitments | Soft, signed, and collected summed separately | A bank deposit is not proof of commitment without an approved mapping |

## Collections grade (3PM scorecard)
Agreed: 95% or more passes. Below 90% is red. From 90% up to but not including 95% is watch. The two thresholds are editable by an admin and audited.

All other scorecard thresholds (occupancy, net move-ins, past due, work-order age, reporting accuracy) are proposed and configurable until approved. The screen says so.

## Freshness
A property is marked stale when its latest metric is more than 40 days old. Metrics show source name, period, and as-of date. A source with no data shows `Not connected`.
