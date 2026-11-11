// "Start here" dashboard data. Built only from other DAL reads, so every item is already filtered to the acting user.
// Nothing here reads fixtures directly. Missing inputs stay null with a reason and never become zero.
import { can, type SessionUser } from "../authz";
import type { Store } from "../store";
import * as dal from "./index";
import * as K from "../kpi";

export type ActionItem = {
  id: string;
  kind: "overdue_task" | "exception" | "deadline" | "unverified_date" | "blocked_deal";
  title: string;
  detail: string;
  href: string;
  external?: boolean;
  tone: "bad" | "warn" | "muted";
  sortKey: string;
};

export type FollowUp = { id: string; kind: "task" | "deal" | "investor"; title: string; detail: string; href: string; external?: boolean };

export type PlanRow = {
  propertyId: string;
  name: string;
  planVersion: string | null;
  occupancy: K.Kpi;
  targetOccupancy: number | null;
  occupancyGap: number | null;
  ttmNoi: K.Kpi;
  targetTtmNoi: number | null;
  noiVariance: K.Kpi;
  status: "ahead" | "on_track" | "behind" | "no_plan" | "unavailable";
  asOf: string | null;
  source: string | null;
};

export type KeyDate = { dueDate: string | null; daysUntil: number | null; tone: "good" | "warn" | "bad" | "muted"; verifiedBy: string | null; sopUrl: string | null; asanaUrl: string | null };
export type KeyDateRow = {
  propertyId: string;
  name: string;
  llc: KeyDate | null;
  insurance: KeyDate | null;
  planVersion: string | null;
  planUrl: string | null;
};

export type BudgetRow = { propertyId: string; name: string; budget: number | null; spent: number | null; pctSpent: number | null; nextStage: string | null; risk: string | null };

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

function planStatus(row: { occupancyGap: number | null; noiVariance: K.Kpi; hasPlan: boolean; hasData: boolean }): PlanRow["status"] {
  if (!row.hasPlan) return "no_plan";
  if (!row.hasData) return "unavailable";
  const noi = row.noiVariance.value;
  const gap = row.occupancyGap;
  if ((noi !== null && noi < 0) || (gap !== null && gap < -3)) return "behind";
  if ((noi !== null && noi >= 0) && (gap === null || gap >= 0)) return "ahead";
  return "on_track";
}

export function startHere(u: SessionUser, store: Store, now: number = Date.now()) {
  const today = iso(now);
  const props = dal.listProperties(u).filter((p) => p.financials);
  const tasks = dal.listTasks(u);
  const mine = tasks.filter((t) => t.assignee.toLowerCase() === u.email.toLowerCase() && t.status === "open");
  const exceptions = dal.listExceptions(u);
  const renewals = dal.propertyRenewals(u);
  const canSeeDeals = can(u, "view_deal_financials", { type: "deal", department: "acquisitions" }) || dal.listDeals(u).length > 0;
  const deals = canSeeDeals ? dal.listDeals(u).filter((d) => d.decision === "active") : [];
  const investors = dal.listInvestors(u);

  // ---- Needs action ----
  const actions: ActionItem[] = [];
  for (const t of mine.filter((t) => t.due && t.due < today)) {
    actions.push({ id: `task-${t.id}`, kind: "overdue_task", title: t.name, detail: `Overdue since ${t.due}`, href: t.url, external: true, tone: "bad", sortKey: `0-${t.due}` });
  }
  for (const e of exceptions.filter((e) => e.severity !== "low")) {
    actions.push({ id: `exc-${e.id}`, kind: "exception", title: e.title, detail: `Owner ${e.owner} · next: ${e.nextAction} · target ${e.targetDate}`, href: `/exceptions/${e.id}`, tone: e.severity === "high" ? "bad" : "warn", sortKey: `${e.severity === "high" ? 1 : 2}-${e.targetDate}` });
  }
  const horizon = iso(now + 14 * DAY);
  for (const r of renewals.filter((r) => r.dueDate && r.dueDate <= horizon)) {
    actions.push({ id: `ren-${r.id}`, kind: "deadline", title: `${r.propertyName}: ${r.type}`, detail: r.daysUntil !== null && r.daysUntil < 0 ? `Past due by ${-r.daysUntil} days` : `Due in ${r.daysUntil} days (${r.dueDate})`, href: `/operations/${r.propertyId}`, tone: r.daysUntil !== null && r.daysUntil < 0 ? "bad" : "warn", sortKey: `3-${r.dueDate}` });
  }
  for (const r of renewals.filter((r) => !r.dueDate)) {
    actions.push({ id: `unv-${r.id}`, kind: "unverified_date", title: `${r.propertyName}: ${r.type}`, detail: "Date unknown. Verify against the signed document.", href: `/operations/${r.propertyId}`, tone: "muted", sortKey: "5" });
  }
  for (const d of deals.filter((d) => d.blockers.length > 0)) {
    actions.push({ id: `blk-${d.id}`, kind: "blocked_deal", title: `${d.name} is blocked`, detail: d.blockers.join("; "), href: `/deals/${d.id}`, tone: "warn", sortKey: `4-${d.ddDeadline ?? "9999"}` });
  }
  actions.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  // ---- Follow up ----
  const followUps: FollowUp[] = [];
  for (const t of mine.filter((t) => !t.due || t.due >= today)) {
    followUps.push({ id: `fu-t-${t.id}`, kind: "task", title: t.name, detail: t.due ? `Due ${t.due}` : "No due date set", href: t.url, external: true });
  }
  const staleCut = iso(now - 14 * DAY);
  for (const d of deals.filter((d) => !d.lastContact || d.lastContact < staleCut)) {
    followUps.push({ id: `fu-d-${d.id}`, kind: "deal", title: `${d.name}: no contact in 14+ days`, detail: d.lastContact ? `Last contact ${d.lastContact}` : "No contact logged", href: `/deals/${d.id}` });
  }
  for (const i of investors.filter((i) => i.nextTouch && i.nextTouch <= iso(now + 7 * DAY))) {
    followUps.push({ id: `fu-i-${i.id}`, kind: "investor", title: `Touchpoint with ${i.name}`, detail: `Next touch ${i.nextTouch}`, href: "/investor-relations" });
  }

  // ---- Portfolio KPIs (average over properties that report; the count is shown so gaps are visible) ----
  const withOcc = props.filter((p) => p.financials!.occupancy.value !== null);
  const rentable = withOcc.reduce((s, p) => s + p.financials!.operationalRentableSites, 0);
  const occValue = rentable > 0 ? withOcc.reduce((s, p) => s + (p.financials!.occupancy.value as number) * p.financials!.operationalRentableSites, 0) / rentable : null;
  const withCol = props.filter((p) => p.financials!.collections.value !== null);
  const colValue = withCol.length ? withCol.reduce((s, p) => s + (p.financials!.collections.value as number), 0) / withCol.length : null;
  const grades = { pass: 0, watch: 0, red: 0, unavailable: 0 };
  const cfg = store.state.kpiConfig;
  for (const p of props) {
    const v = p.financials!.collections.value;
    grades[v === null ? "unavailable" : v >= cfg.collectionsPass ? "pass" : v < cfg.collectionsRed ? "red" : "watch"]++;
  }
  const portfolio = {
    propertiesTotal: props.length,
    occupancy: { value: occValue, reporting: withOcc.length, formula: "Sum of occupied sites over sum of operational rentable sites, for properties that report", unit: "%" as const },
    collections: { value: colValue, reporting: withCol.length, formula: "Simple average of each property's current-period collections. Prior-period recovery excluded", unit: "%" as const },
    grades,
    asOf: props.map((p) => p.financials!.asOf).filter((x): x is string => !!x).sort().at(-1) ?? null,
    stale: props.some((p) => p.financials!.stale),
  };

  // ---- Plan vs actual ----
  const plan: PlanRow[] = props.map((p) => {
    const f = p.financials!;
    const targetOcc = f.plan?.targetOccupancy ?? null;
    const gap = f.occupancy.value !== null && targetOcc !== null ? f.occupancy.value - targetOcc : null;
    const status = planStatus({ occupancyGap: gap, noiVariance: f.variance, hasPlan: !!f.plan, hasData: f.occupancy.value !== null || f.ttmNoi.value !== null });
    return { propertyId: p.id, name: p.name, planVersion: f.plan?.version ?? null, occupancy: f.occupancy, targetOccupancy: targetOcc, occupancyGap: gap, ttmNoi: f.ttmNoi, targetTtmNoi: f.plan?.targetTtmNoi ?? null, noiVariance: f.variance, status, asOf: f.asOf, source: f.source };
  });

  // ---- Key dates: LLC renewal, insurance renewal, and where the business plan lives ----
  // A missing date is shown as "date needed". It is never guessed and never treated as far away.
  const toKeyDate = (r: (typeof renewals)[number] | undefined): KeyDate | null => {
    if (!r) return null;
    const d = r.daysUntil;
    const tone = d === null ? "muted" : d <= 30 ? "bad" : d <= 90 ? "warn" : "good";
    return { dueDate: r.dueDate, daysUntil: d, tone, verifiedBy: r.verifiedBy, sopUrl: r.sopUrl ?? null, asanaUrl: r.asanaUrl ?? null };
  };
  const keyDates: KeyDateRow[] = dal.listProperties(u).map((p) => {
    const mine = renewals.filter((r) => r.propertyId === p.id);
    return {
      propertyId: p.id,
      name: p.name,
      llc: toKeyDate(mine.find((r) => /llc|entity/i.test(r.type))),
      insurance: toKeyDate(mine.find((r) => /insurance/i.test(r.type))),
      planVersion: p.financials?.plan?.version ?? null,
      planUrl: p.links.notion ?? null,
    };
  });

  // ---- Infill budget vs spend (project budget, not operating budget) ----
  const budget: BudgetRow[] = [];
  for (const p of props) {
    const ms = dal.propertyMilestones(u, p.id);
    if (ms.length === 0) continue;
    const budgets = ms.map((m) => m.budget).filter((b): b is number => b !== null);
    const spents = ms.map((m) => m.spent).filter((s): s is number => s !== null);
    const b = budgets.length ? Math.max(...budgets) : null;
    const s = spents.length ? Math.max(...spents) : null;
    const next = ms.filter((m) => !m.actual).sort((a, c) => (a.forecast ?? a.baseline).localeCompare(c.forecast ?? c.baseline))[0];
    budget.push({ propertyId: p.id, name: p.name, budget: b, spent: s, pctSpent: b && s !== null ? (s / b) * 100 : null, nextStage: next?.stage ?? null, risk: next?.risk ?? ms.find((m) => m.risk)?.risk ?? null });
  }

  // ---- Upcoming (next 90 days) ----
  const upcoming = [
    ...renewals.filter((r) => r.dueDate && r.daysUntil !== null && r.daysUntil >= 0 && r.daysUntil <= 90).map((r) => ({ id: `u-r-${r.id}`, date: r.dueDate!, label: `${r.propertyName}: ${r.type}`, kind: "Renewal", href: `/operations/${r.propertyId}` })),
    ...deals.filter((d) => d.ddDeadline && d.ddDeadline >= today && d.ddDeadline <= iso(now + 90 * DAY)).map((d) => ({ id: `u-d-${d.id}`, date: d.ddDeadline!, label: `${d.name}: DD deadline`, kind: "Deal", href: `/deals/${d.id}` })),
    ...tasks.filter((t) => t.status === "open" && t.due && t.due >= today && t.due <= iso(now + 14 * DAY)).map((t) => ({ id: `u-t-${t.id}`, date: t.due!, label: t.name, kind: "Task", href: t.url })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);

  // ---- Where the numbers come from, with honest state ----
  const live = process.env.CCOS_MODE === "live";
  const asana = [...store.state.syncRuns].reverse().find((r) => r.connector.startsWith("asana"));
  const sources = [
    { name: "Asana", role: "Tasks and deals", state: asana ? (asana.ok ? (live ? "live" : "demo") : "error") : "not_connected", detail: asana ? `Last sync ${asana.finishedAt.slice(0, 16).replace("T", " ")}, ${asana.fetched} records` : "Not synced yet" },
    { name: "Rent Manager", role: "Occupancy, collections, delinquency", state: props.length && live ? "live" : props.length ? "demo" : "not_connected", detail: live ? "Read only" : "Synthetic fixtures. Live adapter not enabled" },
    { name: "Notion", role: "Property manuals and SOPs", state: "links_only", detail: "Links only" },
    { name: "Google Drive", role: "Property journals and documents", state: "links_only", detail: "Links only" },
  ] as const;

  const unavailable: { metric: string; reason: string }[] = [
    { metric: "Operating budget vs actual (income and expense lines)", reason: "No approved operating budget is loaded. Add one per property to turn this on." },
    { metric: "Delinquency and aging", reason: "Needs the Rent Manager adapter. Not in the demo data." },
    { metric: "Work-order age", reason: "Needs a work-order source. Not connected." },
  ];

  return { today, actions, keyDates, followUps, portfolio, plan, budget, upcoming, sources, unavailable, counts: { exceptions: exceptions.length, myOpen: mine.length } };
}
