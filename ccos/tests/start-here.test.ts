import { describe, expect, it } from "vitest";
import { startHere } from "@/lib/dal/start-here";
import { mk } from "./helpers";

const { store, u } = mk();
const json = (v: unknown) => JSON.stringify(v ?? null);

describe("start here dashboard", () => {
  it("ops manager gets actions, plan rows and a missing plan is labeled, never zero", () => {
    const s = startHere(u("ops"), store);
    expect(s.actions.length).toBeGreaterThan(0);
    const willow = s.plan.find((r) => r.propertyId === "p-willow")!;
    expect(willow.status).toBe("no_plan");
    expect(willow.noiVariance.value).toBeNull();
    expect(s.portfolio.propertiesTotal).toBe(3);
    expect(s.portfolio.occupancy.reporting).toBe(2);
  });

  it("ops never receives investor or deal-financial data", () => {
    const s = startHere(u("opsstaff"), store);
    expect(json(s)).not.toMatch(/Demo Investor|investor-a@|Maple Grove|Oak Ridge/);
    expect(s.followUps.some((f) => f.kind === "investor" || f.kind === "deal")).toBe(false);
  });

  it("IR sees investor follow-ups but no property data", () => {
    const s = startHere(u("ir"), store);
    expect(s.portfolio.propertiesTotal).toBe(0);
    expect(s.plan).toEqual([]);
    expect(s.followUps.some((f) => f.kind === "investor")).toBe(true);
  });

  it("external PM only sees their own property", () => {
    const s = startHere(u("pm"), store);
    expect(s.plan.map((r) => r.propertyId)).toEqual(["p-cedar"]);
    expect(json(s)).not.toMatch(/River Estates|Willow Bend/);
  });

  it("acquisitions sees stale deal follow-ups and blocked deals, not property data", () => {
    const s = startHere(u("acq"), store);
    expect(s.plan).toEqual([]);
    expect(s.actions.some((a) => a.kind === "blocked_deal")).toBe(true);
  });

  it("states what is not available instead of inventing it", () => {
    const s = startHere(u("ops"), store);
    expect(s.unavailable.map((x) => x.metric).join(" ")).toMatch(/Operating budget/);
  });
});
