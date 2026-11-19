// Read-only Rent Manager reader. It only sends GET requests, plus the one sign-in call Rent Manager requires.
// Needs RENTMANAGER_BASE_URL, RENTMANAGER_USERNAME, RENTMANAGER_PASSWORD and RENTMANAGER_LOCATION_ID, set by the owner in Vercel.
// Create a Rent Manager user with read-only rights for this. Never paste its password in chat.
import { SEED_PROPERTIES } from "../seed-properties";
import type { Db } from "../live-auth";

type Env = Record<string, string | undefined>;
export type RmProperty = { pmId: number; name: string; units: number; occupied: number; owed: number | null };

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

type OpenCharge = { AccountID: number; Amount: number; AmountAllocated: number; TransactionDate?: string };
type OpenPayment = { AccountID: number; Amount: number; AmountAllocated: number; ReversalDate?: string | null };

// Same method as the Rent Manager connector: per current tenant, open charges due today or earlier, minus unapplied payments.
// Residents who owe count toward "owed". Residents with credits do not offset them.
export function owedByProperty(tenants: { TenantID: number; PropertyID: number }[], charges: OpenCharge[], payments: OpenPayment[], today: string): Map<number, number> {
  const bal = new Map<number, number>();
  for (const c of charges) {
    if ((c.TransactionDate ?? "").slice(0, 10) > today) continue;
    const open = (Number(c.Amount) || 0) - (Number(c.AmountAllocated) || 0);
    if (open > 0.005) bal.set(c.AccountID, (bal.get(c.AccountID) ?? 0) + open);
  }
  for (const p of payments) {
    if (p.ReversalDate) continue;
    const unapplied = (Number(p.Amount) || 0) - (Number(p.AmountAllocated) || 0);
    if (unapplied > 0.005) bal.set(p.AccountID, (bal.get(p.AccountID) ?? 0) - unapplied);
  }
  const out = new Map<number, number>();
  for (const t of tenants) {
    const b = bal.get(t.TenantID) ?? 0;
    if (b > 0.005) out.set(t.PropertyID, (out.get(t.PropertyID) ?? 0) + b);
  }
  return out;
}

export async function fetchOccupancy(f: typeof fetch = fetch, e: Env = process.env, now = new Date()): Promise<RmProperty[]> {
  const tok = await token(f, e);
  const props = await getAll<{ PropertyID: number; Name: string; IsActive: boolean }>(f, e, tok, "Properties", "fields=PropertyID,Name,IsActive");
  const units = await getAll<{ UnitID: number; PropertyID: number }>(f, e, tok, "Units", "fields=UnitID,PropertyID");
  const tenants = await getAll<{ TenantID: number; PropertyID: number; Status: string }>(f, e, tok, "Tenants", "fields=TenantID,PropertyID,Status&filters=Status,eq,Current");
  // Balances are a bonus. If this Rent Manager does not offer them, occupancy still updates and owed stays as it was.
  let owed: Map<number, number> | null = null;
  try {
    const open = "filters=IsFullyAllocated,eq,false";
    const charges = await getAll<OpenCharge>(f, e, tok, "Charges", `fields=AccountID,Amount,AmountAllocated,TransactionDate&${open}`);
    const payments = await getAll<OpenPayment>(f, e, tok, "Payments", `fields=AccountID,Amount,AmountAllocated,ReversalDate&${open}`);
    owed = owedByProperty(tenants, charges, payments, now.toISOString().slice(0, 10));
  } catch { owed = null; }
  return props.filter((p) => p.IsActive).map((p) => ({
    pmId: p.PropertyID, name: p.Name,
    units: units.filter((u) => u.PropertyID === p.PropertyID).length,
    occupied: tenants.filter((t) => t.PropertyID === p.PropertyID).length,
    owed: owed ? Math.round((owed.get(p.PropertyID) ?? 0) * 100) / 100 : null,
  })).filter((p) => p.units > 0);
}

// Writes this month's occupancy and amount owed per matched property. Collections are not synced yet.
export async function syncOccupancy(db: Db, f: typeof fetch = fetch, e: Env = process.env, now = new Date()) {
  const rows = await fetchOccupancy(f, e, now);
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const known = new Set((await db.query<{ id: string }>("select id from public.properties")).map((r) => r.id));
  let saved = 0; const unmatched: string[] = [];
  for (const r of rows) {
    const id = matchProperty(r.name);
    if (!id || !known.has(id)) { unmatched.push(r.name); continue; }
    await db.query(
      `insert into public.property_period_metrics (property_id, month, occupied_sites, rentable_sites, delinquent_balance, source, as_of)
       values ($1, $2, $3, $4, $5, 'Rent Manager', $6)
       on conflict (property_id, month) do update set occupied_sites = excluded.occupied_sites, rentable_sites = excluded.rentable_sites,
         delinquent_balance = coalesce(excluded.delinquent_balance, public.property_period_metrics.delinquent_balance), source = excluded.source, as_of = excluded.as_of`,
      [id, month, Math.min(r.occupied, r.units), r.units, r.owed, now.toISOString()]);
    saved++;
  }
  return { saved, unmatched };
}
