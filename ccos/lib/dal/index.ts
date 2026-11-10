// Data Access Layer. Every read takes the acting user and filters BEFORE shaping output.
// Out-of-scope ids behave exactly like missing ids (null), so existence is never revealed.
// Pages, route handlers, server actions, search and AI retrieval must all call these functions, never fixtures directly.
import { can, type Department, type Resource, type SessionUser } from "../authz";
import * as F from "../fixtures";
import * as K from "../kpi";
import type { Deal, Exception, Investor, Property, PropertyMonth, Task } from "../types";
import type { Store } from "../store";

const propRes = (p: Property): Resource => ({ type: "property", id: p.id, department: p.department, propertyId: p.id, entityId: p.entityId });
const dealRes = (d: Deal): Resource => ({ type: "deal", id: d.id, department: d.department, dealId: d.id });
const invRes = (i: Investor): Resource => ({ type: "investor", id: i.id, department: i.department });
const basicProp = (u: SessionUser, p: Property) => can(u, "view_company_summary", propRes(p)) || can(u, "view_property_financials", propRes(p));
const basicDeal = (u: SessionUser, d: Deal) => can(u, "view_company_summary", dealRes(d)) || can(u, "view_deal_financials", dealRes(d));

export type PropertyDto = {
  id: string; name: string; city: string; state: string; status: Property["status"]; links: Property["links"];
  financials: null | {
    asOf: string | null; source: string | null; sourceUrl: string | null; month: string | null;
    occupancy: K.Kpi; collections: K.Kpi; collectionsGrade: ReturnType<typeof K.collectionsGrade>; ttmNoi: K.Kpi; t1Noi: K.Kpi;
    netMoveIns: K.Kpi; variance: K.Kpi; plan: Property["plan"]; trend: { month: string; occupancy: number | null; collections: number | null }[];
    licensedSites: number; operationalRentableSites: number; mix: Property["mix"]; stale: boolean;
  };
  tenantDetailsAllowed: boolean;
};

function monthsFor(id: string): PropertyMonth[] { return F.METRICS.filter((m) => m.propertyId === id).sort((a, b) => a.month.localeCompare(b.month)); }

function shapeProperty(u: SessionUser, p: Property): PropertyDto {
  const base = { id: p.id, name: p.name, city: p.city, state: p.state, status: p.status, links: p.links, tenantDetailsAllowed: can(u, "view_tenant_details", propRes(p)) };
  if (!can(u, "view_property_financials", propRes(p))) return { ...base, financials: null };
  const ms = monthsFor(p.id);
  const latest = ms.at(-1) ?? null;
  const occ = K.physicalOccupancy(latest?.occupied, latest?.rentable);
  const col = K.currentPeriodCollections(latest?.paymentsAllocated, latest?.chargesDue);
  const ttm = K.ttmNoi(ms.map((m) => ({ month: m.month, income: m.income, expense: m.expense })));
  const t1 = K.t1AnnualizedNoi(latest ? { month: latest.month, income: latest.income, expense: latest.expense } : null);
  const nm = K.netMoveIns(latest?.moveIns, latest?.moveOuts);
  const variance = K.businessPlanVariance(ttm.value, p.plan?.targetTtmNoi ?? null);
  const ageDays = latest ? (Date.now() - Date.parse(latest.asOf)) / 86_400_000 : Infinity;
  return {
    ...base,
    financials: {
      asOf: latest?.asOf ?? null, source: latest ? "Rent Manager (fixture)" : null, sourceUrl: latest?.sourceUrl ?? null, month: latest?.month ?? null,
      occupancy: occ, collections: col, collectionsGrade: K.collectionsGrade(col.value), ttmNoi: ttm, t1Noi: t1, netMoveIns: nm, variance,
      plan: p.plan, licensedSites: p.licensedSites, operationalRentableSites: p.operationalRentableSites, mix: p.mix, stale: ageDays > 40,
      trend: ms.map((m) => ({ month: m.month, occupancy: K.physicalOccupancy(m.occupied, m.rentable).value, collections: K.currentPeriodCollections(m.paymentsAllocated, m.chargesDue).value })),
    },
  };
}

export function listProperties(u: SessionUser): PropertyDto[] {
  return F.PROPERTIES.filter((p) => basicProp(u, p)).map((p) => shapeProperty(u, p));
}
export function getProperty(u: SessionUser, id: string): PropertyDto | null {
  const p = F.PROPERTIES.find((x) => x.id === id);
  return p && basicProp(u, p) ? shapeProperty(u, p) : null;
}
export function propertyMilestones(u: SessionUser, id: string) {
  const p = F.PROPERTIES.find((x) => x.id === id);
  if (!p || !can(u, "view_property_financials", propRes(p))) return [];
  return F.MILESTONES.filter((m) => m.propertyId === id).map((m) => ({ ...m, slipDays: m.forecast ? Math.round((Date.parse(m.forecast) - Date.parse(m.baseline)) / 86_400_000) : null }));
}
export function propertyRenewals(u: SessionUser, id: string | null = null) {
  return F.RENEWALS.filter((r) => (id ? r.propertyId === id : true)).filter((r) => {
    const p = F.PROPERTIES.find((x) => x.id === r.propertyId);
    return p && can(u, "view_property_financials", propRes(p));
  }).map((r) => ({ ...r, propertyName: F.PROPERTIES.find((x) => x.id === r.propertyId)?.name ?? "", daysUntil: r.dueDate ? Math.round((Date.parse(r.dueDate) - Date.now()) / 86_400_000) : null }))
    .sort((a, b) => (a.daysUntil ?? 99_999) - (b.daysUntil ?? 99_999));
}
export function propertyTasks(u: SessionUser, id: string) { return listTasks(u).filter((t) => t.propertyId === id); }

// Property manager scorecard. Collections thresholds come from approved config. Other thresholds are proposed and say so.
export function pmScorecards(u: SessionUser, store: Store) {
  const { collectionsPass, collectionsRed } = store.state.kpiConfig;
  return listProperties(u).filter((p) => p.financials).map((p) => {
    const f = p.financials!;
    const grade = f.collections.value === null ? "unavailable" : f.collections.value >= collectionsPass ? "pass" : f.collections.value < collectionsRed ? "red" : "watch";
    return { propertyId: p.id, name: p.name, collections: f.collections, grade, occupancy: f.occupancy, netMoveIns: f.netMoveIns, proposedThresholds: true };
  });
}

// ---- deals ----
export type DealDto = Omit<Deal, "askingPrice" | "loiPrice" | "noi" | "askingCap" | "uwVersion" | "links" | "lender"> & {
  financials: null | { askingPrice: number | null; loiPrice: number | null; noi: number | null; askingCap: number | null; uwVersion: string | null; lender: string | null };
  links: Deal["links"]; screening: { passes: boolean; reasons: string[] };
};
export function screen(d: Deal, cfg = { minLots: 50, excludeUtilities: ["wwtp", "lagoon"] as string[], flagUtilities: ["private_septic"] as string[] }) {
  const reasons: string[] = [];
  if (d.kind === "asset" && (d.lots === null || d.lots < cfg.minLots)) reasons.push(`Under ${cfg.minLots} lots in one park`);
  if (cfg.excludeUtilities.includes(d.utility)) reasons.push(`Excluded utility: ${d.utility}`);
  if (cfg.flagUtilities.includes(d.utility)) reasons.push("Private septic: flag for diligence");
  if (d.utility === "unknown") reasons.push("Utility type unknown");
  return { passes: !reasons.some((r) => r.startsWith("Under") || r.startsWith("Excluded")), reasons };
}
function shapeDeal(u: SessionUser, d: Deal): DealDto {
  const fin = can(u, "view_deal_financials", dealRes(d));
  const { askingPrice, loiPrice, noi, askingCap, uwVersion, lender, links, ...rest } = d;
  return { ...rest, links, financials: fin ? { askingPrice, loiPrice, noi, askingCap, uwVersion, lender } : null, screening: screen(d) };
}
export function listDeals(u: SessionUser, f: { stage?: string; state?: string; q?: string; owner?: string; utility?: string } = {}) {
  const q = f.q?.toLowerCase();
  return F.DEALS.filter((d) => basicDeal(u, d))
    .filter((d) => (!f.stage || d.stage === f.stage) && (!f.state || d.state === f.state) && (!f.owner || d.owner === f.owner) && (!f.utility || d.utility === f.utility) && (!q || d.name.toLowerCase().includes(q)))
    .map((d) => shapeDeal(u, d));
}
export function getDeal(u: SessionUser, id: string): DealDto | null {
  const d = F.DEALS.find((x) => x.id === id);
  return d && basicDeal(u, d) ? shapeDeal(u, d) : null;
}
export function dealSourceRecords(u: SessionUser, id: string, store: Store) {
  if (!getDeal(u, id)) return [];
  return store.state.sourceRecords.filter((r) => r.internalId === id).map((r) => ({ source: r.source, externalId: r.externalId, name: r.name, url: r.url, asOf: r.asOf, projectGid: r.projectGid }));
}
export function pipelineKpi(u: SessionUser, store: Store) {
  const deals = F.DEALS.filter((d) => can(u, "view_deal_financials", dealRes(d)) && d.decision === "active");
  const links = store.state.entityLinks;
  const rows = deals.map((d) => ({ id: d.id, canonicalId: d.id, stage: d.stage, basis: d.askingPrice ? ("asking_price" as const) : null, amount: d.askingPrice }));
  // Count of raw source records that collapsed into canonical deals, shown so duplicates are visible.
  const sourceCount = store.state.sourceRecords.filter((r) => deals.some((d) => d.id === r.internalId)).length;
  return { kpi: K.dealPipelineValue(rows, "asking_price"), canonicalDeals: deals.length, sourceRecords: sourceCount, linkCount: links.length };
}

// ---- investors (restricted) ----
export function listInvestors(u: SessionUser) {
  return F.INVESTORS.filter((i) => can(u, "view_investor_pii", invRes(i))).map((i) => ({ ...i, commitments: F.COMMITMENTS.filter((c) => c.investorId === i.id) }));
}
export function irSummary(u: SessionUser) {
  const inv = listInvestors(u);
  if (inv.length === 0 && !can(u, "view_investor_pii", { type: "investor", department: "ir" })) return null;
  return K.irCommitments(inv.flatMap((i) => i.commitments.map((c) => ({ investorId: c.investorId, kind: c.kind, amount: c.amount }))));
}

// ---- tasks, exceptions, docs ----
const taskRes = (t: Task): Resource => ({ type: "task", id: t.id, department: t.department, propertyId: t.propertyId, dealId: t.dealId });
export function listTasks(u: SessionUser): Task[] {
  return F.TASKS.filter((t) => can(u, "view_company_summary", taskRes(t)) || can(u, "view_property_financials", taskRes(t)) || can(u, "view_deal_financials", taskRes(t)));
}
export function myWork(u: SessionUser) {
  const mine = listTasks(u).filter((t) => t.assignee.toLowerCase() === u.email.toLowerCase());
  const today = new Date().toISOString().slice(0, 10);
  return { overdue: mine.filter((t) => t.status === "open" && t.due && t.due < today), upcoming: mine.filter((t) => t.status === "open" && (!t.due || t.due >= today)) };
}
const excRes = (e: Exception): Resource => ({ type: e.dealId ? "deal" : e.propertyId ? "property" : "org", department: e.department, propertyId: e.propertyId, dealId: e.dealId, id: e.dealId ?? e.propertyId });
export function listExceptions(u: SessionUser): Exception[] {
  const r = { high: 0, medium: 1, low: 2 } as const;
  return F.EXCEPTIONS.filter((e) => can(u, "view_company_summary", excRes(e)) || can(u, "view_property_financials", excRes(e)) || can(u, "view_deal_financials", excRes(e)) || (e.department === "ir" && can(u, "view_investor_pii", { type: "investor", department: "ir" })))
    .sort((a, b) => r[a.severity] - r[b.severity] || a.targetDate.localeCompare(b.targetDate));
}
export function getException(u: SessionUser, id: string) { return listExceptions(u).find((e) => e.id === id) ?? null; }
export function listDocs(u: SessionUser) {
  return F.DOCS.filter((d) => { const res: Resource = { type: "document", department: d.department, propertyId: d.propertyId }; return can(u, "view_company_summary", res) || can(u, "view_property_financials", res); });
}

// ---- executive ----
export function executiveBrief(u: SessionUser, store: Store, scope: "portfolio" | "deals" = "portfolio") {
  if (!can(u, "view_executive")) return null;
  const exceptions = listExceptions(u);
  const props = listProperties(u);
  const deadlines = [
    ...propertyRenewals(u).filter((r) => r.daysUntil !== null && r.daysUntil <= 90).map((r) => ({ label: `${r.propertyName}: ${r.type}`, date: r.dueDate!, kind: "renewal" })),
    ...F.DEALS.filter((d) => d.ddDeadline).map((d) => ({ label: `${d.name}: DD deadline`, date: d.ddDeadline!, kind: "deal" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return {
    scope, exceptions, deadlines, properties: props, pipeline: pipelineKpi(u, store), ir: irSummary(u),
    blockedDecisions: F.DEALS.filter((d) => d.decision === "active" && d.blockers.length > 0).map((d) => ({ id: d.id, name: d.name, blockers: d.blockers })),
    valueAtRisk: exceptions.reduce((s, e) => s + (e.valueAtRisk ?? 0), 0),
  };
}

// ---- search (filters first, so counts and snippets never leak) ----
export type SearchHit = { type: string; id: string; title: string; href: string; snippet?: string };
export function search(u: SessionUser, q: string): SearchHit[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const hits: SearchHit[] = [];
  listProperties(u).filter((p) => (p.name + p.city + p.state).toLowerCase().includes(needle)).forEach((p) => hits.push({ type: "Property", id: p.id, title: p.name, href: `/operations/${p.id}`, snippet: `${p.city}, ${p.state}` }));
  listDeals(u).filter((d) => (d.name + d.city + d.state).toLowerCase().includes(needle)).forEach((d) => hits.push({ type: "Deal", id: d.id, title: d.name, href: `/deals/${d.id}`, snippet: `${d.stage} · ${d.city}, ${d.state}` }));
  listInvestors(u).filter((i) => i.name.toLowerCase().includes(needle)).forEach((i) => hits.push({ type: "Investor", id: i.id, title: i.name, href: `/investor-relations`, snippet: i.relationship }));
  listTasks(u).filter((t) => t.name.toLowerCase().includes(needle)).forEach((t) => hits.push({ type: "Task", id: t.id, title: t.name, href: t.url }));
  listDocs(u).filter((d) => d.title.toLowerCase().includes(needle)).forEach((d) => hits.push({ type: "Document", id: d.id, title: d.title, href: d.url }));
  return hits.slice(0, 50);
}

export function visibleDepartments(u: SessionUser): Department[] {
  const out: Department[] = [];
  if (listDeals(u).length) out.push("acquisitions");
  if (listProperties(u).length) out.push("operations");
  if (listInvestors(u).length || can(u, "view_investor_pii", { type: "investor", department: "ir" })) out.push("ir");
  if (can(u, "view_executive")) out.push("executive");
  return out;
}
