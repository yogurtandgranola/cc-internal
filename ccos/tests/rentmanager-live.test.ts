import { describe, expect, it } from "vitest";
import { matchProperty, syncOccupancy } from "@/lib/connectors/rentmanager-live";

describe("rent manager live", () => {
  it("matches real Rent Manager names to property ids", () => {
    expect(matchProperty("Fortescue Park H, LLC")).toBe("fortescue-park");
    expect(matchProperty("Springhill MHC H, LLC")).toBe("springhill-mhc");
    expect(matchProperty("CC MHC Management")).toBeNull();
  });
  it("saves occupancy and reports unmatched names", async () => {
    const calls: unknown[][] = [];
    const db = { query: async (sql: string, p?: unknown[]) => { if (sql.startsWith("select id")) return [{ id: "fortescue-park" }]; calls.push(p ?? []); return []; }, tx: async () => { throw new Error("no"); } } as never;
    const json = (b: unknown) => new Response(JSON.stringify(b));
    const f = (async (url: string) => {
      if (url.includes("Authentication")) return json("tok");
      if (url.includes("Properties")) return json([{ PropertyID: 10, Name: "Fortescue Park H, LLC", IsActive: true }, { PropertyID: 99, Name: "Mystery Park", IsActive: true }]);
      if (url.includes("Units")) return json([{ UnitID: 1, PropertyID: 10 }, { UnitID: 2, PropertyID: 10 }, { UnitID: 3, PropertyID: 99 }]);
      return json([{ PropertyID: 10, Status: "Current" }, { PropertyID: 99, Status: "Current" }]);
    }) as unknown as typeof fetch;
    const out = await syncOccupancy(db, f, { RENTMANAGER_BASE_URL: "https://x", RENTMANAGER_USERNAME: "u", RENTMANAGER_PASSWORD: "p", RENTMANAGER_LOCATION_ID: "1" }, new Date("2026-11-11T12:00:00Z"));
    expect(out).toEqual({ saved: 1, unmatched: ["Mystery Park"] });
    expect(calls[0]).toEqual(["fortescue-park", "2026-11-01", 1, 2, "2026-11-11T12:00:00.000Z"]);
  });
});
