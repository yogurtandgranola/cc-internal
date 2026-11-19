import { describe, expect, it } from "vitest";
import { matchProperty, owedByProperty, syncOccupancy } from "@/lib/connectors/rentmanager-live";

describe("rent manager live", () => {
  it("matches real Rent Manager names to property ids", () => {
    expect(matchProperty("Fortescue Park H, LLC")).toBe("fortescue-park");
    expect(matchProperty("Springhill MHC H, LLC")).toBe("springhill-mhc");
    expect(matchProperty("CC MHC Management")).toBeNull();
  });
  it("adds up what residents owe: open charges due by today, minus unapplied payments, credits do not offset others", () => {
    const owed = owedByProperty(
      [{ TenantID: 1, PropertyID: 10 }, { TenantID: 2, PropertyID: 10 }, { TenantID: 3, PropertyID: 11 }],
      [{ AccountID: 1, Amount: 300, AmountAllocated: 0, TransactionDate: "2026-11-01" }, { AccountID: 1, Amount: 300, AmountAllocated: 0, TransactionDate: "2026-12-01" }, { AccountID: 3, Amount: 100, AmountAllocated: 40, TransactionDate: "2026-11-05" }],
      [{ AccountID: 1, Amount: 100, AmountAllocated: 0 }, { AccountID: 2, Amount: 80, AmountAllocated: 0 }, { AccountID: 3, Amount: 20, AmountAllocated: 0, ReversalDate: "2026-11-06" }],
      "2026-11-11");
    expect(owed.get(10)).toBe(200); // tenant 1 owes 300 - 100; tenant 2's credit of 80 does not reduce it
    expect(owed.get(11)).toBe(60);  // reversed payment ignored
  });

  it("saves occupancy and reports unmatched names", async () => {
    const calls: unknown[][] = [];
    const db = { query: async (sql: string, p?: unknown[]) => { if (sql.startsWith("select id")) return [{ id: "fortescue-park" }]; calls.push(p ?? []); return []; }, tx: async () => { throw new Error("no"); } } as never;
    const json = (b: unknown) => new Response(JSON.stringify(b));
    const f = (async (url: string) => {
      if (url.includes("Authentication")) return json("tok");
      if (url.includes("Properties")) return json([{ PropertyID: 10, Name: "Fortescue Park H, LLC", IsActive: true }, { PropertyID: 99, Name: "Mystery Park", IsActive: true }]);
      if (url.includes("Units")) return json([{ UnitID: 1, PropertyID: 10 }, { UnitID: 2, PropertyID: 10 }, { UnitID: 3, PropertyID: 99 }]);
      if (url.includes("Charges")) return json([{ AccountID: 7, Amount: 500, AmountAllocated: 100, TransactionDate: "2026-11-01T00:00:00" }, { AccountID: 7, Amount: 500, AmountAllocated: 0, TransactionDate: "2026-12-01T00:00:00" }]);
      if (url.includes("Payments")) return json([{ AccountID: 8, Amount: 50, AmountAllocated: 0, ReversalDate: null }]);
      return json([{ TenantID: 7, PropertyID: 10, Status: "Current" }, { TenantID: 8, PropertyID: 10, Status: "Current" }, { TenantID: 9, PropertyID: 99, Status: "Current" }]);
    }) as unknown as typeof fetch;
    const out = await syncOccupancy(db, f, { RENTMANAGER_BASE_URL: "https://x", RENTMANAGER_USERNAME: "u", RENTMANAGER_PASSWORD: "p", RENTMANAGER_LOCATION_ID: "1" }, new Date("2026-11-11T12:00:00Z"));
    expect(out).toEqual({ saved: 1, unmatched: ["Mystery Park"] });
    expect(calls[0]).toEqual(["fortescue-park", "2026-11-01", 2, 2, 400, "2026-11-11T12:00:00.000Z"]);
  });
});
