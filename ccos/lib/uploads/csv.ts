// Snapshot file: one row per property. Columns (header row required, extra columns ignored):
// property, month, as_of, total_sites, occupied_sites, charged, paid, owed, move_ins, move_outs
// Blank cells mean "not known" and are stored as empty, never as zero.
import type { PacketRow } from "./rm-packet";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z]+/g, "_");
const numOrNull = (s: string | undefined): number | null | "bad" => {
  const v = (s ?? "").trim().replace(/[$,]/g, "");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : "bad";
};

export function parseSnapshotCsv(text: string): { rows: PacketRow[]; problems: string[] } {
  const [head, ...body] = parseCsv(text);
  const problems: string[] = [];
  if (!head) return { rows: [], problems: ["The file is empty."] };
  const col = new Map(head.map((h, i) => [norm(h), i] as const));
  for (const need of ["property", "month", "as_of", "total_sites", "occupied_sites"]) {
    if (!col.has(need)) problems.push(`Missing column: ${need}.`);
  }
  if (problems.length) return { rows: [], problems };
  const get = (r: string[], k: string) => (col.has(k) ? r[col.get(k)!] : undefined);
  const rows: PacketRow[] = [];
  body.forEach((r, i) => {
    const line = i + 2;
    const name = (get(r, "property") ?? "").trim();
    const month = (get(r, "month") ?? "").trim();
    const asOf = (get(r, "as_of") ?? "").trim();
    const sites = numOrNull(get(r, "total_sites")), occ = numOrNull(get(r, "occupied_sites"));
    const optional = (k: string) => numOrNull(get(r, k));
    const [charged, paid, owed, ins, outs] = ["charged", "paid", "owed", "move_ins", "move_outs"].map(optional);
    if (!name) { problems.push(`Line ${line}: no property name.`); return; }
    if (!/^\d{4}-\d\d-01$/.test(month) || !/^\d{4}-\d\d-\d\d$/.test(asOf)) { problems.push(`${name}: month must look like 2026-11-01 and as_of like 2026-11-19.`); return; }
    if (typeof sites !== "number" || typeof occ !== "number" || !Number.isInteger(sites) || !Number.isInteger(occ) || sites <= 0 || occ < 0 || occ > sites) { problems.push(`${name}: total and occupied sites must be whole numbers, with occupied no larger than total.`); return; }
    if ([charged, paid, owed, ins, outs].includes("bad")) { problems.push(`${name}: a number could not be read.`); return; }
    rows.push({ propertyName: name, month, asOf, rentable: sites, occupied: occ, chargesDue: charged as number | null, paid: paid as number | null, delinquent: owed as number | null, moveIns: ins as number | null, moveOuts: outs as number | null, warnings: [], source: "Rent Manager snapshot, uploaded" });
  });
  if (rows.length === 0 && problems.length === 0) problems.push("No property rows were found.");
  return { rows, problems };
}
