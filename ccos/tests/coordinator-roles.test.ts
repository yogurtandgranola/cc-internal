import { describe, expect, it } from "vitest";
import * as dal from "@/lib/dal";
import { startHere } from "@/lib/dal/start-here";
import { can, ROLE_PERMISSIONS, type Grant, type SessionUser } from "@/lib/authz";
import { mk } from "./helpers";

const { store } = mk();
const user = (id: string, ...grants: Grant[]): SessionUser => ({ id, email: `${id}@x.test`, name: id, active: true, sessionVersion: 1, grants });
const g = (role: Grant["role"], scopeType: Grant["scopeType"], scopeId: string | null = null): Grant => ({ role, scopeType, scopeId });
const json = (v: unknown) => JSON.stringify(v ?? null);

describe("ops staff limited to assigned properties (one grant per property)", () => {
  const riverOnly = user("staff1", g("ops_staff", "property", "p-river"));
  it("sees only the assigned property everywhere", () => {
    expect(dal.listProperties(riverOnly).map((p) => p.id)).toEqual(["p-river"]);
    expect(dal.getProperty(riverOnly, "p-cedar")).toBeNull();
    expect(dal.getProperty(riverOnly, "p-willow")).toBeNull();
    expect(dal.propertyRenewals(riverOnly).every((r) => r.propertyId === "p-river")).toBe(true);
    expect(dal.listTasks(riverOnly).every((t) => !t.propertyId || t.propertyId === "p-river")).toBe(true);
    expect(dal.search(riverOnly, "Cedar")).toEqual([]);
    expect(json(startHere(riverOnly, store))).not.toMatch(/Cedar Park|Willow Bend/);
  });
  it("two assigned properties show two, and still no tenant detail or other property", () => {
    const two = user("staff2", g("ops_staff", "property", "p-river"), g("ops_staff", "property", "p-cedar"));
    expect(dal.listProperties(two).map((p) => p.id).sort()).toEqual(["p-cedar", "p-river"]);
    expect(dal.getProperty(two, "p-willow")).toBeNull();
    expect(dal.getProperty(two, "p-river")!.tenantDetailsAllowed).toBe(false);
  });
  it("cannot reach deals or investors", () => {
    expect(dal.listDeals(riverOnly)).toEqual([]);
    expect(dal.listInvestors(riverOnly)).toEqual([]);
  });
});

describe("acquisitions coordinator", () => {
  const c = user("acqc", g("acquisitions_coordinator", "department", "acquisitions"));
  it("sees the pipeline and diligence dates but no prices or underwriting numbers", () => {
    const deals = dal.listDeals(c);
    expect(deals.length).toBeGreaterThan(0);
    for (const d of deals) expect(d.financials).toBeNull();
    expect(json(deals)).not.toMatch(/3900000|4950000|5200000|askingPrice|uwVersion|lender/);
    expect(deals.some((d) => d.ddDeadline)).toBe(true);
  });
  it("sees no property or investor data", () => {
    expect(dal.listProperties(c)).toEqual([]);
    expect(dal.listInvestors(c)).toEqual([]);
    expect(dal.irSummary(c)).toBeNull();
    expect(dal.pipelineKpi(c, store).canonicalDeals).toBe(0);
  });
  it("can keep local task notes but holds no money, user or investor permission", () => {
    expect(can(c, "manage_tasks_local", { type: "task", department: "acquisitions" })).toBe(true);
    for (const p of ["view_deal_financials", "view_property_financials", "view_tenant_details", "view_investor_pii", "view_executive", "manage_users", "request_external_write"] as const) expect(ROLE_PERMISSIONS.acquisitions_coordinator).not.toContain(p);
  });
});

describe("IR coordinator: sees what is due, never investor contact details", () => {
  const c = user("irc", g("ir_coordinator", "department", "ir"));
  it("sees IR tasks that are due", () => {
    const tasks = dal.listTasks(c);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.department === "ir")).toBe(true);
    expect(startHere(c, store).upcoming.some((x) => x.kind === "Task")).toBe(true);
  });
  it("gets no investor list, contact detail, commitment, or amount through any path", () => {
    expect(dal.listInvestors(c)).toEqual([]);
    expect(dal.irSummary(c)).toBeNull();
    expect(dal.search(c, "investor-a@demo.example")).toEqual([]);
    expect(dal.visibleDepartments(c)).not.toContain("ir"); // no Investor Relations page
    const everything = json([dal.listTasks(c), dal.listExceptions(c), dal.listDocs(c), dal.listProperties(c), dal.listDeals(c), startHere(c, store), dal.executiveBrief(c, store)]);
    expect(everything).not.toMatch(/investor-a@|investor-b@|250000|150000|100000|"kind":"signed"|contactEmail/);
  });
  it("sees no property or deal data", () => {
    expect(dal.listProperties(c)).toEqual([]);
    expect(dal.listDeals(c)).toEqual([]);
  });
  it("holds no investor, money, user or integration permission", () => {
    for (const p of ["view_investor_pii", "view_deal_financials", "view_property_financials", "view_tenant_details", "view_executive", "manage_users", "manage_integrations", "request_external_write"] as const) expect(ROLE_PERMISSIONS.ir_coordinator).not.toContain(p);
  });
});
