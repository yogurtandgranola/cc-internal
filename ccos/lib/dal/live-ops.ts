// Live property numbers for real signed-in users, read from the database and filtered by the user's grants.
import { can, type SessionUser } from "../authz";
import type { Db } from "../live-auth";

export type LiveRow = { id: string; name: string; city: string | null; state: string | null; occupied: number | null; rentable: number | null; charged: number | null; paid: number | null; owed: number | null; asOf: string | null; source: string | null };

export async function liveProperties(u: SessionUser, db: Db): Promise<LiveRow[]> {
  const rows = await db.query<{ id: string; name: string; city: string | null; state: string | null; department: string | null; entity_id: string | null; occupied: number | null; rentable: number | null; charged: string | null; paid: string | null; owed: string | null; as_of: Date | null; source: string | null }>(
    `select p.id, p.name, p.city, p.state, p.department, p.entity_id, m.occupied_sites as occupied, m.rentable_sites as rentable, m.charges_due as charged, m.payments_allocated as paid, m.delinquent_balance as owed, m.as_of, m.source
     from public.properties p
     left join lateral (select * from public.property_period_metrics x where x.property_id = p.id order by month desc limit 1) m on true
     order by p.name`);
  return rows
    .filter((r) => can(u, "view_property_financials", { type: "property", id: r.id, propertyId: r.id, department: (r.department ?? "operations") as never, entityId: r.entity_id ?? undefined }))
    .map((r) => ({ id: r.id, name: r.name, city: r.city, state: r.state, occupied: r.occupied, rentable: r.rentable, charged: r.charged == null ? null : Number(r.charged), paid: r.paid == null ? null : Number(r.paid), owed: r.owed == null ? null : Number(r.owed), asOf: r.as_of ? new Date(r.as_of).toISOString() : null, source: r.source }));
}
