// Real sign-in. Supabase Auth checks the password. Roles and access come from our own tables, read on every request.
// Default deny: a valid Supabase login with no profile and no grant gets nothing.
// The only exception is the owner email set in CCOS_OWNER_EMAIL, and only while no active owner exists.
import crypto from "node:crypto";
import pg from "pg";
import { mac } from "./auth";
import { ROLES } from "./roles";
import type { Grant, SessionUser } from "./authz";
import { pgConfig } from "./pg-config";
import { SEED_PROPERTIES } from "./seed-properties";

export type Db = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  tx: <T>(fn: (q: Db["query"]) => Promise<T>) => Promise<T>;
};
export type LiveDeps = { fetch: typeof fetch; db: Db; env: Record<string, string | undefined>; now: () => number };
export type LoginResult = { ok: true; token: string; user: SessionUser } | { ok: false; reason: "invalid" | "no_access" | "switched_off" | "throttled" | "unavailable" };

const TOKEN_PREFIX = "L1";
const TTL_SEC = 8 * 3600;

const supabaseUrl = (e: LiveDeps["env"]) => e.SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = (e: LiveDeps["env"]) => e.SUPABASE_PUBLISHABLE_KEY || e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || e.SUPABASE_ANON_KEY;
const dbUrl = (e: LiveDeps["env"]) => e.POSTGRES_URL || e.POSTGRES_URL_NON_POOLING;

export function liveAuthConfigured(env: LiveDeps["env"] = process.env): boolean {
  return Boolean(supabaseUrl(env) && publishableKey(env) && dbUrl(env));
}
export const isLiveToken = (t: string | undefined | null): t is string => Boolean(t && t.startsWith(TOKEN_PREFIX + "."));

// ---- database ----
const g = globalThis as unknown as { __ccos_pool?: pg.Pool };
export function defaultDb(env: LiveDeps["env"] = process.env): Db {
  const url = dbUrl(env);
  if (!url) throw new Error("No database configured");
  if (!g.__ccos_pool) g.__ccos_pool = new pg.Pool({ ...pgConfig(url), max: 3, idleTimeoutMillis: 10_000 });
  const pool = g.__ccos_pool;
  const query: Db["query"] = async (sql, params = []) => (await pool.query(sql, params as unknown[])).rows;
  return {
    query,
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query("begin");
        const out = await fn(async (sql, params = []) => (await c.query(sql, params as unknown[])).rows);
        await c.query("commit");
        return out;
      } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
    },
  };
}
export function defaultDeps(): LiveDeps {
  return { fetch, db: defaultDb(), env: process.env, now: Date.now };
}

// ---- session state ----
type Profile = { id: string; email: string; name: string; active: boolean; must_change_password: boolean };
const isRole = (r: string): r is Grant["role"] => (ROLES as readonly string[]).includes(r);

async function loadUser(db: Db, id: string): Promise<SessionUser | null> {
  const [p] = await db.query<Profile>("select id, email, name, active, must_change_password from public.profiles where id = $1", [id]);
  if (!p || !p.active) return null;
  const rows = await db.query<{ role: string; scope_type: Grant["scopeType"]; scope_id: string | null }>(
    "select role, scope_type, scope_id from public.user_role_grants where user_id = $1 and revoked_at is null", [id]);
  const grants: Grant[] = rows.filter((r) => isRole(r.role)).map((r) => ({ role: r.role as Grant["role"], scopeType: r.scope_type, scopeId: r.scope_id }));
  return { id: p.id, email: p.email, name: p.name, active: true, sessionVersion: 1, grants, live: true, mustChangePassword: p.must_change_password };
}
// Any change to active status or to grants changes this value, which ends existing sessions on the next request.
export function stateHash(u: Pick<SessionUser, "active" | "grants">): string {
  const g = u.grants.map((x) => `${x.role}|${x.scopeType}|${x.scopeId ?? ""}`).sort().join(";");
  return crypto.createHash("sha256").update(`${u.active}:${g}`).digest("hex").slice(0, 20);
}
export function signLiveToken(u: SessionUser, now: number): string {
  const payload = `${u.id}.${stateHash(u)}.${Math.floor(now / 1000) + TTL_SEC}`;
  return `${TOKEN_PREFIX}.${Buffer.from(payload).toString("base64url")}.${mac(payload)}`;
}
export async function liveUserFromToken(token: string | undefined | null, deps: LiveDeps): Promise<SessionUser | null> {
  if (!isLiveToken(token)) return null;
  const [, p, sig] = token.split(".");
  if (!p || !sig) return null;
  let payload: string;
  try { payload = Buffer.from(p, "base64url").toString("utf8"); } catch { return null; }
  const expect = mac(payload);
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  const [id, hash, exp] = payload.split(".");
  if (!id || !hash || !exp || Number(exp) < deps.now() / 1000) return null;
  let user: SessionUser | null;
  try { user = await loadUser(deps.db, id); } catch { return null; }
  if (!user || user.grants.length === 0 || stateHash(user) !== hash) return null;
  return user;
}

// ---- sign-in ----
const attempts = new Map<string, { n: number; first: number }>();
export function resetLiveThrottle() { attempts.clear(); }

async function auditEvent(db: Db, actor: string, action: string, ok: boolean, target?: string) {
  try { await db.query("insert into public.audit_events (actor, action, target, ok) values ($1, $2, $3, $4)", [actor, action, target ?? null, ok]); } catch { /* audit is best effort here, never blocks sign-in */ }
}

export async function liveLogin(emailIn: string, password: string, deps: LiveDeps): Promise<LoginResult> {
  const email = emailIn.trim().toLowerCase();
  if (!email || !password || email.endsWith("@demo.example")) return { ok: false, reason: "invalid" };
  const now = deps.now();
  const a = attempts.get(email);
  if (a && now - a.first < 15 * 60_000 && a.n >= 5) return { ok: false, reason: "throttled" };
  const fail = () => {
    const cur = a && now - a.first < 15 * 60_000 ? a : { n: 0, first: now };
    attempts.set(email, { n: cur.n + 1, first: cur.first });
  };

  let authUserId: string;
  try {
    const res = await deps.fetch(`${supabaseUrl(deps.env)}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: publishableKey(deps.env) ?? "" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status >= 500) return { ok: false, reason: "unavailable" };
    if (!res.ok) { fail(); await auditEvent(deps.db, email, "login.failed", false); return { ok: false, reason: "invalid" }; }
    const body = (await res.json()) as { user?: { id?: string; email?: string } };
    if (!body.user?.id || body.user.email?.toLowerCase() !== email) { fail(); return { ok: false, reason: "invalid" }; }
    authUserId = body.user.id;
  } catch { return { ok: false, reason: "unavailable" }; }

  try {
    let user = await loadUser(deps.db, authUserId);
    if (!user) {
      // The password was right. Say clearly when the owner has switched this person off.
      const p = (await deps.db.query<{ active: boolean }>("select active from public.profiles where id = $1", [authUserId]))[0];
      if (p && !p.active) { await auditEvent(deps.db, email, "login.switched_off", false); return { ok: false, reason: "switched_off" }; }
      user = await bootstrapOwner(deps, authUserId, email);
    }
    if (!user || user.grants.length === 0) { await auditEvent(deps.db, email, "login.no_access", false); return { ok: false, reason: "no_access" }; }
    attempts.delete(email);
    await auditEvent(deps.db, authUserId, "login.success", true);
    return { ok: true, token: signLiveToken(user, now), user };
  } catch { return { ok: false, reason: "unavailable" }; }
}

// First owner. Only the email in CCOS_OWNER_EMAIL, only while no active owner exists, and only after Supabase confirmed the password.
async function bootstrapOwner(deps: LiveDeps, authUserId: string, email: string): Promise<SessionUser | null> {
  const ownerEmail = deps.env.CCOS_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail || ownerEmail !== email) return null;
  await deps.db.tx(async (q) => {
    const owners = await q("select 1 from public.user_role_grants g join public.profiles p on p.id = g.user_id where g.role = 'owner_admin' and g.revoked_at is null and p.active limit 1");
    if (owners.length > 0) return;
    let org = (await q<{ id: string }>("select id from public.organizations order by created_at limit 1"))[0];
    if (!org) org = (await q<{ id: string }>("insert into public.organizations (name) values ('Cornell Communities') returning id"))[0];
    if (!org) throw new Error("Could not create the organization");
    await seedProperties(q, org.id);
    const name = (email.split("@")[0] ?? email).replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    await q("insert into public.profiles (id, org_id, email, name) values ($1, $2, $3, $4) on conflict (id) do nothing", [authUserId, org.id, email, name]);
    await q("insert into public.user_role_grants (user_id, role, scope_type, scope_id, created_by) values ($1, 'owner_admin', 'org', null, $1)", [authUserId]);
    await q("insert into public.audit_events (actor, action, target, ok) values ($1, 'bootstrap.first_owner', $2, true)", [authUserId, email]);
  });
  return loadUser(deps.db, authUserId);
}

// The company's properties, by name only, so the permission pickers list real parks. Runs only while the table is empty.
export async function seedProperties(q: Db["query"], orgId: string): Promise<void> {
  const have = await q<{ n: number }>("select count(*)::int as n from public.properties");
  if ((have[0]?.n ?? 0) > 0) return;
  for (const p of SEED_PROPERTIES) {
    await q("insert into public.properties (id, org_id, name, city, state) values ($1, $2, $3, $4, $5) on conflict (id) do nothing", [p.id, orgId, p.name, p.city, p.state]);
  }
}
