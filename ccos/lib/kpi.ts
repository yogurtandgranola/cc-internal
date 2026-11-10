// KPI math. Pure functions. Every result carries unit, formula, and an explicit unavailable state.
// A missing input yields value null with a reason. It never becomes zero.

export type Kpi = {
  key: string;
  value: number | null;
  unit: "%" | "$" | "count" | "ratio";
  formula: string;
  status: "ok" | "unavailable" | "warning";
  reason?: string;
  note?: string;
};

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function unavailable(key: string, unit: Kpi["unit"], formula: string, reason: string): Kpi {
  return { key, value: null, unit, formula, status: "unavailable", reason };
}

export function physicalOccupancy(occupiedOperationalSites?: number | null, operationalRentableSites?: number | null): Kpi {
  const formula = "occupied_operational_sites / total_operational_rentable_sites";
  if (!num(occupiedOperationalSites) || !num(operationalRentableSites)) return unavailable("physical_occupancy", "%", formula, "Site counts not reported");
  if (operationalRentableSites <= 0) return unavailable("physical_occupancy", "%", formula, "No operational rentable sites");
  if (occupiedOperationalSites < 0 || occupiedOperationalSites > operationalRentableSites) return unavailable("physical_occupancy", "%", formula, "Occupied sites exceed rentable sites, verify source");
  return { key: "physical_occupancy", value: (occupiedOperationalSites / operationalRentableSites) * 100, unit: "%", formula, status: "ok" };
}

// Current-period collections: payments allocated to this period's charges over net charges due this period.
// Prior-period recoveries are tracked separately and never added to the numerator.
export function currentPeriodCollections(paymentsAllocatedToCurrentCharges?: number | null, netCurrentChargesDue?: number | null): Kpi {
  const formula = "payments_allocated_to_charges_due_this_period / net_current_period_charges_due";
  if (!num(paymentsAllocatedToCurrentCharges) || !num(netCurrentChargesDue)) return unavailable("current_period_collections", "%", formula, "Charges or payments not reported");
  if (netCurrentChargesDue <= 0) return unavailable("current_period_collections", "%", formula, "No net charges due in period");
  const v = (paymentsAllocatedToCurrentCharges / netCurrentChargesDue) * 100;
  if (v > 100) return { key: "current_period_collections", value: v, unit: "%", formula, status: "warning", reason: "Above 100%: likely prepayments or mis-allocated recoveries, verify allocation" };
  return { key: "current_period_collections", value: v, unit: "%", formula, status: "ok" };
}

export type MonthlyNoi = { month: string; income: number | null; expense: number | null };

export function ttmNoi(months: MonthlyNoi[]): Kpi {
  const formula = "sum(recognized operating income) - sum(operating expense) over the same 12 complete calendar months; excludes debt service, capex, owner contributions";
  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  if (sorted.length < 12) return unavailable("ttm_noi", "$", formula, `Only ${sorted.length} of 12 months available`);
  if (sorted.some((m) => !num(m.income) || !num(m.expense))) return unavailable("ttm_noi", "$", formula, "A month is missing income or expense; missing expense is never inferred");
  const v = sorted.reduce((s, m) => s + (m.income as number) - (m.expense as number), 0);
  return { key: "ttm_noi", value: v, unit: "$", formula, status: "ok" };
}

export function t1AnnualizedNoi(latest?: MonthlyNoi | null): Kpi {
  const formula = "most recent complete month NOI * 12 (annualized T1, not TTM)";
  if (!latest || !num(latest.income) || !num(latest.expense)) return unavailable("t1_annualized_noi", "$", formula, "Latest month missing income or expense");
  return { key: "t1_annualized_noi", value: (latest.income - latest.expense) * 12, unit: "$", formula, status: "warning", note: "Annualized single month. Volatile for seasonal or one-time items.", reason: "Not a TTM figure" };
}

export function businessPlanVariance(actual?: number | null, approvedTarget?: number | null, periodsMatch = true): Kpi {
  const formula = "actual - approved_target (periods matched, approval version recorded)";
  if (!num(actual) || !num(approvedTarget)) return unavailable("business_plan_variance", "$", formula, "Actual or approved target missing");
  if (!periodsMatch) return unavailable("business_plan_variance", "$", formula, "Actual and target cover different periods");
  return { key: "business_plan_variance", value: actual - approvedTarget, unit: "$", formula, status: "ok" };
}

export function netMoveIns(moveIns?: number | null, moveOuts?: number | null): Kpi {
  const formula = "move_ins - move_outs over the agreed date range";
  if (!num(moveIns) || !num(moveOuts)) return unavailable("net_move_ins", "count", formula, "Move-in or move-out counts not reported");
  return { key: "net_move_ins", value: moveIns - moveOuts, unit: "count", formula, status: "ok" };
}

// Pipeline value counts each canonical deal once, using one declared basis. Records without that basis are excluded and counted.
export type PipelineDeal = { id: string; canonicalId?: string | null; stage: string; basis: "asking_price" | "loi_price" | null; amount: number | null };
export function dealPipelineValue(deals: PipelineDeal[], basis: "asking_price" | "loi_price"): Kpi & { excluded: number; counted: number } {
  const formula = `sum of ${basis} over canonical deals, each deal counted once; deals without ${basis} excluded`;
  const seen = new Set<string>();
  let total = 0;
  let counted = 0;
  let excluded = 0;
  for (const d of deals) {
    const key = d.canonicalId ?? d.id;
    if (seen.has(key)) continue;
    seen.add(key);
    if (d.basis === basis && num(d.amount)) { total += d.amount; counted++; } else excluded++;
  }
  if (counted === 0) return { ...unavailable("deal_pipeline_value", "$", formula, "No deals with this basis"), excluded, counted };
  return { key: "deal_pipeline_value", value: total, unit: "$", formula, status: excluded > 0 ? "warning" : "ok", reason: excluded > 0 ? `${excluded} deal(s) excluded for missing ${basis}` : undefined, excluded, counted };
}

export type Commitment = { investorId: string; kind: "soft" | "signed" | "collected"; amount: number };
export function irCommitments(rows: Commitment[]) {
  const formula = "soft indications, signed commitments, and collected capital are summed separately; a deposit is not proof of commitment";
  const sum = (k: Commitment["kind"]) => rows.filter((r) => r.kind === k).reduce((s, r) => s + r.amount, 0);
  return { formula, soft: sum("soft"), signed: sum("signed"), collected: sum("collected") };
}

// 3PM scorecard collections grade. 95% is the agreed passing grade, 90% means a problem.
export function collectionsGrade(pct: number | null): "pass" | "watch" | "red" | "unavailable" {
  if (pct === null || !num(pct)) return "unavailable";
  if (pct >= 95) return "pass";
  if (pct < 90) return "red";
  return "watch";
}
