import { describe, expect, it } from "vitest";
import { parsePacket } from "@/lib/uploads/rm-packet";
import { savePacket } from "@/lib/uploads/save";
import type { SessionUser } from "@/lib/authz";

// Synthetic pages in the same shape as the Rent Manager PDF text. No real tenants or figures.
const rentRoll = (prop: string, charged: string, paid: string, credit: string, debit: string, units: number, vacant: number) =>
  `Tenant Unit\nSummary Rent Roll\nProperty: ${prop}\nCurrent tenants in the period 11/01/26 to 11/09/26\nTotal\nCharged\n${charged}\nTotal Paid\n${paid}\nCredit\nBalances\n${credit}\nDebit\nBalances\n${debit}\nTotal Units: ${units} Vacant Units: ${vacant} Vacant Rent: 0.00\nRentManager.com 11/09/26 07:00 AM 1 of 1`;
const moves = (prop: string, ins: number, outs: number, occ: number) =>
  `Move In / Move Out From 11/01/26 to 11/09/26\nProperty: ${prop}\nSummary\n${ins}: Move Ins\n${outs}: Move Outs\nOccupancy Reconciliation\nOccupancy on 10/31/26: 10\nOccupancy on 11/09/26: ${occ}\nRentManager.com 11/09/26 07:00 AM 1 of 1`;

describe("rent manager weekly packet", () => {
  it("reads totals per property and prefers the move-in report occupancy", () => {
    const { rows, problems } = parsePacket([
      rentRoll("Emporia MHC LLC", "33,250.00", "23,150.00", "-4,193.00", "24,072.00", 195, 99),
      moves("Emporia MHC LLC", 1, 0, 94),
      rentRoll("Parktown MHP", "19,920.00", "13,446.00", "-10.00", "7,064.00", 81, 42),
      moves("Parktown MHP", 0, 0, 39),
    ]);
    expect(problems).toEqual([]);
    expect(rows[0]).toMatchObject({ propertyName: "Emporia MHC LLC", month: "2026-11-01", asOf: "2026-11-09", rentable: 195, occupied: 94, chargesDue: 33250, paid: 23150, delinquent: 24072, moveIns: 1, moveOuts: 0 });
    expect(rows[0]!.warnings).toHaveLength(1);
    expect(rows[1]).toMatchObject({ propertyName: "Parktown MHP", occupied: 39, rentable: 81, warnings: [] });
  });
  it("rejects a file that is not the packet", () => {
    const { rows, problems } = parsePacket(["Some other report\nProperty: X"]);
    expect(rows).toEqual([]);
    expect(problems[0]).toMatch(/does not look like/);
  });
  it("saves only rows for matched properties the person may upload for", async () => {
    const writes: unknown[][] = [];
    const db = { query: async (sql: string, p?: unknown[]) => { if (sql.startsWith("select id")) return [{ id: "emporia" }, { id: "parktown" }]; writes.push([sql.slice(0, 30), ...(p ?? [])]); return []; }, tx: async () => { throw new Error("no"); } } as never;
    const { rows } = parsePacket([rentRoll("Emporia MHC LLC", "10.00", "5.00", "0.00", "5.00", 10, 2), rentRoll("Mystery MHC", "10.00", "5.00", "0.00", "5.00", 10, 2)]);
    const manager = { id: "u1", email: "a@b.c", name: "A", active: true, sessionVersion: 1, live: true, grants: [{ role: "ops_manager", scopeType: "org", scopeId: null }] } as SessionUser;
    const r = await savePacket(db, manager, "x.pdf", rows);
    expect(r).toEqual({ saved: ["Emporia MHC LLC"], skipped: ["Mystery MHC"] });
    const viewer = { ...manager, grants: [{ role: "ops_staff", scopeType: "org", scopeId: null }] } as SessionUser;
    expect((await savePacket(db, viewer, "x.pdf", rows)).saved).toEqual([]);
    const tampered = rows.map((x) => ({ ...x, occupied: 999 }));
    expect((await savePacket(db, manager, "x.pdf", tampered)).saved).toEqual([]);
  });
});
