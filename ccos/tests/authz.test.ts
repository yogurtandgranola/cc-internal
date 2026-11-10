import { describe, expect, it } from "vitest";
import * as dal from "@/lib/dal";
import { can } from "@/lib/authz";
import { mk } from "./helpers";

const { store, u } = mk();
const json = (v: unknown) => JSON.stringify(v ?? null);

describe("role separation (demo 2 and 3)", () => {
  it("ops staff sees property KPIs but no investor identity, commitments, or PII through any DAL path", () => {
    const ops = u("opsstaff");
    expect(dal.listProperties(ops).length).toBe(3);
    expect(dal.listInvestors(ops)).toEqual([]);
    expect(dal.irSummary(ops)).toBeNull();
    expect(dal.search(ops, "Demo Investor")).toEqual([]);
    expect(dal.search(ops, "investor-a@demo.example")).toEqual([]);
    const everything = json([dal.listProperties(ops), dal.listDeals(ops), dal.listTasks(ops), dal.listExceptions(ops), dal.listDocs(ops), dal.executiveBrief(ops, store)]);
    expect(everything).not.toMatch(/Demo Investor|investor-a@|250000|"kind":"signed"/);
  });

  it("ops staff cannot see tenant details, ops manager can", () => {
    expect(dal.getProperty(u("opsstaff"), "p-cedar")!.tenantDetailsAllowed).toBe(false);
    expect(dal.getProperty(u("ops"), "p-cedar")!.tenantDetailsAllowed).toBe(true);
  });

  it("IR staff cannot read property financials, tenant details or deals", () => {
    const ir = u("ir");
    expect(dal.listInvestors(ir).length).toBe(2);
    expect(dal.listProperties(ir)).toEqual([]);
    expect(dal.getProperty(ir, "p-cedar")).toBeNull();
    expect(dal.listDeals(ir)).toEqual([]);
    expect(dal.propertyRenewals(ir)).toEqual([]);
    expect(dal.search(ir, "Cedar")).toEqual([]);
  });

  it("acquisitions manager sees deal financials, acquisitions staff does not", () => {
    expect(dal.getDeal(u("acq"), "d-oak")!.financials?.askingPrice).toBe(3_900_000);
    const staff = mk();
    const s = staff.store.state.users.find((x) => x.email === "acq@demo.example")!;
    s.grants = [{ role: "acquisitions_staff", scopeType: "department", scopeId: "acquisitions" }];
    const d = dal.getDeal(s, "d-oak")!;
    expect(d.financials).toBeNull();
    expect(JSON.stringify(d)).not.toMatch(/3900000|288000/);
  });

  it("only the founder reaches the executive view", () => {
    expect(dal.executiveBrief(u("founder"), store)).not.toBeNull();
    for (const n of ["ops", "opsstaff", "acq", "ir", "pm"]) expect(dal.executiveBrief(u(n), store)).toBeNull();
  });
});

describe("external PM single-property scope (demo 4)", () => {
  const pm = u("pm");
  it("sees exactly one property", () => expect(dal.listProperties(pm).map((p) => p.id)).toEqual(["p-cedar"]));
  it("forged ids resolve like missing ids", () => {
    expect(dal.getProperty(pm, "p-river")).toBeNull();
    expect(dal.getProperty(pm, "p-willow")).toBeNull();
    expect(dal.getProperty(pm, "../p-river")).toBeNull();
    expect(dal.propertyMilestones(pm, "p-river")).toEqual([]);
    expect(dal.propertyTasks(pm, "p-river")).toEqual([]);
  });
  it("search, tasks, exceptions and renewals are scoped to the one property", () => {
    expect(dal.search(pm, "River")).toEqual([]);
    expect(dal.listTasks(pm).every((t) => t.propertyId === "p-cedar")).toBe(true);
    expect(dal.listExceptions(pm)).toEqual([]);
    expect(dal.propertyRenewals(pm).every((r) => r.propertyId === "p-cedar")).toBe(true);
    expect(json(dal.listProperties(pm))).not.toMatch(/River|Willow/);
  });
  it("sees no deals, investors or other departments", () => {
    expect(dal.listDeals(pm)).toEqual([]);
    expect(dal.listInvestors(pm)).toEqual([]);
    expect(dal.visibleDepartments(pm)).toEqual(["operations"]);
  });
});

describe("default deny", () => {
  it("anonymous and inactive users have no permissions", () => {
    expect(can(null, "view_company_summary")).toBe(false);
    const inactive = { ...u("founder"), active: false };
    expect(can(inactive, "view_company_summary")).toBe(false);
  });
  it("an ops role granted org scope still cannot reach IR records", () => {
    const m = mk();
    const o = m.store.state.users.find((x) => x.email === "ops@demo.example")!;
    o.grants = [{ role: "ops_manager", scopeType: "org", scopeId: null }];
    expect(dal.listInvestors(o)).toEqual([]);
    expect(dal.listDeals(o)).toEqual([]);
  });
  it("a user with no grants sees nothing", () => {
    const m = mk();
    const x = { ...m.u("ops"), grants: [] };
    expect([dal.listProperties(x), dal.listDeals(x), dal.listInvestors(x), dal.listTasks(x), dal.listExceptions(x), dal.search(x, "Demo")].every((r) => r.length === 0)).toBe(true);
  });
});
