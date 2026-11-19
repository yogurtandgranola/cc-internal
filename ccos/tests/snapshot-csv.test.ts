import { describe, expect, it } from "vitest";
import { parseSnapshotCsv } from "@/lib/uploads/csv";

const head = "property,month,as_of,total_sites,occupied_sites,charged,paid,owed,move_ins,move_outs";
describe("snapshot csv", () => {
  it("reads quoted names, blanks as unknown, and tags the source", () => {
    const { rows, problems } = parseSnapshotCsv(`${head}\n"Fortescue Park H, LLC",2026-11-01,2026-11-19,36,31,,,27575.26,,\n`);
    expect(problems).toEqual([]);
    expect(rows[0]).toMatchObject({ propertyName: "Fortescue Park H, LLC", rentable: 36, occupied: 31, chargesDue: null, paid: null, delinquent: 27575.26, moveIns: null, source: "Rent Manager snapshot, uploaded" });
  });
  it("rejects bad rows with a plain reason and keeps the good ones", () => {
    const { rows, problems } = parseSnapshotCsv(`${head}\nA,2026-11-01,2026-11-19,10,12,,,,,\nB,2026-11-01,2026-11-19,10,8,,,,,\n`);
    expect(rows.map((r) => r.propertyName)).toEqual(["B"]);
    expect(problems[0]).toMatch(/occupied no larger than total/);
  });
  it("needs the main columns", () => {
    expect(parseSnapshotCsv("property,month\nA,2026-11-01").problems[0]).toMatch(/Missing column/);
  });
});
