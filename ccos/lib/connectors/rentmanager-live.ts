// Read-only Rent Manager reader. It only sends GET requests, plus the one sign-in call Rent Manager requires.
// Needs RENTMANAGER_BASE_URL, RENTMANAGER_USERNAME, RENTMANAGER_PASSWORD and RENTMANAGER_LOCATION_ID, set by the owner in Vercel.
// Create a Rent Manager user with read-only rights for this. Never paste its password in chat.
import { SEED_PROPERTIES } from "../seed-properties";
import type { Db } from "../live-auth";

type Env = Record<string, string | undefined>;
export type RmProperty = { pmId: number; name: string; units: number; occupied: number };

export const rentManagerConfigured = (e: Env = process.env) =>
  Boolean(e.RENTMANAGER_BASE_URL && e.RENTMANAGER_USERNAME && e.RENTMANAGER_PASSWORD && e.RENTMANAGER_LOCATION_ID);

const norm = (s: string) => s.toLowerCase().replace(/,|\bllc\b|\bh\b|\bmh\/rv\b|\bmhc\b|\bmhp\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
export function matchProperty(rmName: string): string | null {
  const n = norm(rmName);
  const hit = SEED_PROPERTIES.find((p) => norm(p.name) === n) ?? SEED_PROPERTIES.find((p) => norm(p.name).startsWith(n) || n.startsWith(norm(p.name)));
  return n && hit ? hit.id : null;
}

async function token(f: typeof fetch, e: Env): Promise<string> {
  const res = await f(`${e.RENTMANAGER_BASE_URL}/Authentication/AuthorizeUser`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ Username: e.RENTMANAGER_USERNAME, Password: e.RENTMANAGER_PASSWORD, LocationID: Number(e.RENTMANAGER_LOCATION_ID) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Rent Manager sign-in failed (${res.status})`);
  const t = await res.json();
  if (typeof t !== "string" || !t) throw new Error("Rent Manager sign-in gave no token");
  return t;
}
async function getAll<T>(f: typeof fetch, e: Env, tok: string, path: string, query: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page < 60; page++) {
    const res = await f(`${e.RENTMANAGER_BASE_URL}/${path}?${query}&pagesize=1000&pagenumber=${page}`, { headers: { "X-RM12Api-ApiToken": tok }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Rent Manager ${path} failed (${res.status})`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function fetchOccupancy(f: typeof fetch = fetch, e: Env = process.env): Promise<RmProperty[]> {
  const tok = await token(f, e);
  const props = await getAll<{ PropertyID: number; Name: string; IsActive: boolean }>(f, e, tok, "Properties", "fields=PropertyID,Name,IsActive");
  const units = await getAll<{ UnitID: number; PropertyID: number }>(f, e, tok, "Units", "fields=UnitID,PropertyID");
  const tenants = await getAll<{ PropertyID: number; Status: string }>(f, e, tok, "Tenants", "fields=PropertyID,Status&filters=Status,eq,Current");
  return props.filter((p) => p.IsActive).map((p) => ({
    pmId: p.PropertyID, name: p.Name,
    units: units.filter((u) => u.PropertyID === p.PropertyID).length,
    occupied: tenants.filter((t) => t.PropertyID === p.PropertyID).length,
  })).filter((p) => p.units > 0);
}

// Writes this month's occupancy per matched property. Collections need charge and payment data and are not synced yet.
export async function syncOccupancy(db: Db, f: typeof fetch = fetch, e: Env = process.env, now = new Date()) {
  const rows = await fetchOccupancy(f, e);
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const known = new Set((await db.query<{ id: string }>("select id from public.properties")).map((r) => r.id));
  let saved = 0; const unmatched: string[] = [];
  for (const r of rows) {
    const id = matchProperty(r.name);
    if (!id || !known.has(id)) { unmatched.push(r.name); continue; }
    await db.query(
      `insert into public.property_period_metrics (property_id, month, occupied_sites, rentable_sites, source, as_of)
       values ($1, $2, $3, $4, 'Rent Manager', $5)
       on conflict (property_id, month) do update set occupied_sites = excluded.occupied_sites, rentable_sites = excluded.rentable_sites, source = excluded.source, as_of = excluded.as_of`,
      [id, month, Math.min(r.occupied, r.units), r.units, now.toISOString()]);
    saved++;
  }
  return { saved, unmatched };
}
