import { can, HttpError, type SessionUser } from "../authz";
import type { Db } from "../live-auth";
import { matchProperty } from "../connectors/rentmanager-live";
import type { PacketRow } from "./rm-packet";

export type Resolved = PacketRow & { propertyId: string | null };

export async function resolveRows(db: Db, rows: PacketRow[]): Promise<Resolved[]> {
  const have = new Set((await db.query<{ id: string }>("select id from public.properties")).map((r) => r.id));
  return rows.map((r) => { const id = matchProperty(r.propertyName); return { ...r, propertyId: id && have.has(id) ? id : null }; });
}

const okNum = (n: unknown, min = -1e9) => typeof n === "number" && Number.isFinite(n) && n >= min && n < 1e9;
const okOrNull = (n: unknown) => n === null || okNum(n);

// Saves reviewed rows. Every row is re-checked here, because the form data comes from the browser.
export async function savePacket(db: Db, user: SessionUser, fileName: string, rows: PacketRow[], now = new Date()): Promise<{ saved: string[]; skipped: string[] }> {
  if (!user.live) throw new HttpError(403, "Forbidden");
  const resolved = await resolveRows(db, rows);
  const saved: string[] = [], skipped: string[] = [];
  for (const r of resolved) {
    const valid = typeof r.propertyName === "string" && /^\d{4}-\d\d-01$/.test(r.month) && /^\d{4}-\d\d-\d\d$/.test(r.asOf)
      && Number.isInteger(r.rentable) && r.rentable > 0 && Number.isInteger(r.occupied) && r.occupied >= 0 && r.occupied <= r.rentable
      && okOrNull(r.chargesDue) && okOrNull(r.paid) && okOrNull(r.delinquent) && okOrNull(r.moveIns) && okOrNull(r.moveOuts);
    if (!valid || !r.propertyId) { skipped.push(r.propertyName); continue; }
    if (!can(user, "upload_data", { type: "property", id: r.propertyId, propertyId: r.propertyId, department: "operations" })) { skipped.push(r.propertyName); continue; }
    await db.query(
      `insert into public.property_period_metrics (property_id, month, occupied_sites, rentable_sites, charges_due, payments_allocated, delinquent_balance, move_ins, move_outs, source, as_of)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (property_id, month) do update set occupied_sites = excluded.occupied_sites, rentable_sites = excluded.rentable_sites,
         charges_due = excluded.charges_due, payments_allocated = excluded.payments_allocated, delinquent_balance = excluded.delinquent_balance,
         move_ins = excluded.move_ins, move_outs = excluded.move_outs, source = excluded.source, as_of = excluded.as_of`,
      [r.propertyId, r.month, r.occupied, r.rentable, r.chargesDue, r.paid, r.delinquent, r.moveIns, r.moveOuts, "Uploaded Rent Manager weekly packet", `${r.asOf}T12:00:00Z`]);
    saved.push(r.propertyName);
  }
  await db.query("insert into public.audit_events (actor, action, target, ok) values ($1, 'upload.rm_packet', $2, $3)",
    [user.id, `${fileName.slice(0, 120)}: saved ${saved.join(", ") || "none"}${skipped.length ? `; skipped ${skipped.join(", ")}` : ""}`.slice(0, 500), saved.length > 0]);
  return { saved, skipped };
}
