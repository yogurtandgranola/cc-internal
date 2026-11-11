// People and permissions for real accounts. Every function checks the acting user again, runs its writes in one transaction,
// and writes an audit row. Rules (same as the demo admin and the database policies):
//  - only someone with the manage_users permission (the owner) can change access
//  - nobody changes their own access or deactivates themselves
//  - only an owner can hand out owner access
//  - the last active owner can never be removed or deactivated
//  - a role can only be given at scopes that make sense for it, and the scope must exist
import crypto from "node:crypto";
import { HttpError, can, DEPARTMENTS, type Grant, type Role, type ScopeType, type SessionUser } from "./authz";
import { ROLES, ROLE_HOME } from "./roles";
import { ROLE_INFO } from "./role-info";
import { seedProperties, type Db } from "./live-auth";

// ---- Supabase Auth admin calls (server only, service key) ----
export type AuthAdmin = {
  createUser: (email: string, password: string, name: string) => Promise<string>;
  setPassword: (userId: string, password: string) => Promise<void>;
  checkPassword: (email: string, password: string) => Promise<boolean>;
};
export type AdminDeps = { db: Db; auth: AuthAdmin };

export function supabaseAuthAdmin(env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch): AuthAdmin {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  const publishable = env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  const admin = (): Record<string, string> => {
    if (!url || !serviceKey) throw new HttpError(400, "Supabase is not configured for user management.");
    // Newer secret keys go in the apikey header only. The older service key is a JWT and is also sent as a bearer token.
    return serviceKey.startsWith("sb_secret_") ? { apikey: serviceKey, "content-type": "application/json" } : { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" };
  };
  return {
    async createUser(email, password, name) {
      const res = await fetcher(`${url}/auth/v1/admin/users`, { method: "POST", headers: admin(), body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: name } }), signal: AbortSignal.timeout(10_000) });
      if (res.status === 422) throw new HttpError(400, "That email already has a login.");
      if (!res.ok) throw new HttpError(400, "Could not create the login. Try again in a minute.");
      const body = (await res.json()) as { id?: string };
      if (!body.id) throw new HttpError(400, "Could not create the login.");
      return body.id;
    },
    async setPassword(userId, password) {
      const res = await fetcher(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: "PUT", headers: admin(), body: JSON.stringify({ password }), signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new HttpError(400, "Could not set the password. Try again in a minute.");
    },
    async checkPassword(email, password) {
      const res = await fetcher(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: publishable ?? "", "content-type": "application/json" }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(10_000) });
      return res.ok;
    },
  };
}

// ---- helpers ----
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isRole = (r: string): r is Role => (ROLES as readonly string[]).includes(r);
export const tempPassword = () => crypto.randomBytes(12).toString("base64url");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function assertManager(actor: SessionUser) {
  if (!actor.live) throw new HttpError(403, "Forbidden");
  if (!can(actor, "manage_users")) throw new HttpError(403, "Forbidden");
}
const isOwner = (u: SessionUser) => u.grants.some((g) => g.role === "owner_admin" && g.scopeType === "org");

async function audit(q: Db["query"], actor: SessionUser, action: string, target: string | null, detail: string | null) {
  await q("insert into public.audit_events (actor, action, target, detail, ok) values ($1, $2, $3, $4, true)", [actor.id, action, target, detail]);
}
const describe = (g: { role: string; scopeType: string; scopeId: string | null }) => `${g.role}@${g.scopeType}${g.scopeId ? ":" + g.scopeId : ""}`;

async function activeOwnersExcluding(q: Db["query"], userId: string): Promise<number> {
  const r = await q<{ n: number }>(
    "select count(*)::int as n from public.user_role_grants g join public.profiles p on p.id = g.user_id where g.role = 'owner_admin' and g.revoked_at is null and p.active and g.user_id <> $1", [userId]);
  return r[0]?.n ?? 0;
}
const lockAdminChanges = (q: Db["query"]) => q("select pg_advisory_xact_lock(7001)");

// A grant must make sense: allowed scope for the role, and the scope must exist.
export async function validateGrant(q: Db["query"], role: string, scopeType: string, scopeId: string | null): Promise<void> {
  if (!isRole(role)) throw new HttpError(400, "Choose a role.");
  const allowed = ROLE_INFO[role].scopes as readonly string[];
  if (!allowed.includes(scopeType)) throw new HttpError(400, `${ROLE_INFO[role].label} cannot be limited that way.`);
  if (scopeType === "org") { if (scopeId) throw new HttpError(400, "Whole-company access has no scope."); return; }
  if (!scopeId) throw new HttpError(400, "Choose where this access applies.");
  if (scopeType === "department") {
    if (!(DEPARTMENTS as readonly string[]).includes(scopeId)) throw new HttpError(400, "Unknown department.");
    const home = ROLE_HOME[role];
    if (home && home !== scopeId) throw new HttpError(400, `${ROLE_INFO[role].label} belongs to the ${home} department.`);
    return;
  }
  const table = scopeType === "property" ? "properties" : scopeType === "deal" ? "deals" : scopeType === "investor" ? "investor_relationships" : null;
  if (!table) throw new HttpError(400, "That scope is not available.");
  const found = await q(`select 1 from public.${table} where id = $1`, [scopeId]);
  if (found.length === 0) throw new HttpError(400, scopeType === "property" ? "Unknown property." : `No ${scopeType} with that id. Use the department instead.`);
}

function normalizeScopes(scopeType: string, scopeIds: string[]): (string | null)[] {
  if (scopeType === "org") return [null];
  const ids = [...new Set(scopeIds.map((s) => s.trim()).filter(Boolean))];
  if (ids.length === 0) throw new HttpError(400, "Choose where this access applies.");
  return ids;
}

// ---- reads ----
export type PersonRow = { id: string; email: string; name: string; active: boolean; mustChangePassword: boolean; grants: { id: string; role: Role; scopeType: ScopeType; scopeId: string | null }[] };
export type PropertyChoice = { id: string; name: string; city: string | null; state: string | null };

export async function listPeople(actor: SessionUser, db: Db): Promise<PersonRow[]> {
  assertManager(actor);
  const people = await db.query<{ id: string; email: string; name: string; active: boolean; must_change_password: boolean }>("select id, email, name, active, must_change_password from public.profiles order by active desc, lower(name)");
  const grants = await db.query<{ id: string; user_id: string; role: Role; scope_type: ScopeType; scope_id: string | null }>("select id, user_id, role, scope_type, scope_id from public.user_role_grants where revoked_at is null order by created_at");
  return people.map((p) => ({ id: p.id, email: p.email, name: p.name, active: p.active, mustChangePassword: p.must_change_password, grants: grants.filter((g) => g.user_id === p.id).map((g) => ({ id: g.id, role: g.role, scopeType: g.scope_type, scopeId: g.scope_id })) }));
}
export async function listPropertyChoices(actor: SessionUser, db: Db): Promise<PropertyChoice[]> {
  assertManager(actor);
  const org = (await db.query<{ org_id: string }>("select org_id from public.profiles where id = $1", [actor.id]))[0];
  if (org) await seedProperties(db.query, org.org_id);
  return db.query<PropertyChoice>("select id, name, city, state from public.properties order by lower(name)");
}
export async function recentAudit(actor: SessionUser, db: Db, limit = 40) {
  assertManager(actor);
  return db.query<{ at: string; who: string; action: string; target: string | null; detail: string | null; ok: boolean }>(
    "select a.at, coalesce(p.email, a.actor) as who, a.action, a.target, a.detail, a.ok from public.audit_events a left join public.profiles p on p.id::text = a.actor order by a.at desc limit $1", [limit]);
}

// ---- writes ----
export async function addPerson(deps: AdminDeps, actor: SessionUser, input: { email: string; name: string; role: string; scopeType: string; scopeIds: string[] }): Promise<{ userId: string; tempPassword: string | null }> {
  assertManager(actor);
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!EMAIL.test(email)) throw new HttpError(400, "Enter a valid email address.");
  if (name.length < 2) throw new HttpError(400, "Enter the person's name.");
  const scopes = normalizeScopes(input.scopeType, input.scopeIds);
  for (const s of scopes) await validateGrant(deps.db.query, input.role, input.scopeType, s);
  if (input.role === "owner_admin" && !isOwner(actor)) throw new HttpError(403, "Only an owner can grant owner access.");
  if ((await deps.db.query("select 1 from public.profiles where lower(email) = $1", [email])).length > 0) throw new HttpError(400, "That person already has access. Use \"Give more access\" on their row.");

  // Reuse a login that already exists in Supabase. Otherwise make one with a temporary password.
  const existing = (await deps.db.query<{ id: string }>("select id from auth.users where lower(email) = $1", [email]))[0];
  let userId = existing?.id ?? "";
  let temp: string | null = null;
  if (!existing) { temp = tempPassword(); userId = await deps.auth.createUser(email, temp, name); }

  await deps.db.tx(async (q) => {
    await lockAdminChanges(q);
    const org = (await q<{ org_id: string }>("select org_id from public.profiles where id = $1", [actor.id]))[0];
    if (!org) throw new HttpError(403, "Forbidden");
    await q("insert into public.profiles (id, org_id, email, name, invited_by, must_change_password) values ($1, $2, $3, $4, $5, $6)", [userId, org.org_id, email, name, actor.id, temp !== null]);
    for (const s of scopes) await q("insert into public.user_role_grants (user_id, role, scope_type, scope_id, created_by) values ($1, $2, $3, $4, $5)", [userId, input.role, input.scopeType, s, actor.id]);
    await audit(q, actor, "person.add", email, scopes.map((s) => describe({ role: input.role, scopeType: input.scopeType, scopeId: s })).join(", "));
  });
  return { userId, tempPassword: temp };
}

export async function addGrants(deps: AdminDeps, actor: SessionUser, userId: string, input: { role: string; scopeType: string; scopeIds: string[] }): Promise<number> {
  assertManager(actor);
  if (userId === actor.id) throw new HttpError(403, "You cannot change your own access.");
  const scopes = normalizeScopes(input.scopeType, input.scopeIds);
  for (const s of scopes) await validateGrant(deps.db.query, input.role, input.scopeType, s);
  if (input.role === "owner_admin" && !isOwner(actor)) throw new HttpError(403, "Only an owner can grant owner access.");
  return deps.db.tx(async (q) => {
    await lockAdminChanges(q);
    const target = (await q<{ email: string; active: boolean }>("select email, active from public.profiles where id = $1", [userId]))[0];
    if (!target) throw new HttpError(404, "Person not found.");
    let added = 0;
    for (const s of scopes) {
      const dup = await q("select 1 from public.user_role_grants where user_id = $1 and role = $2 and scope_type = $3 and scope_id is not distinct from $4 and revoked_at is null", [userId, input.role, input.scopeType, s]);
      if (dup.length > 0) continue;
      await q("insert into public.user_role_grants (user_id, role, scope_type, scope_id, created_by) values ($1, $2, $3, $4, $5)", [userId, input.role, input.scopeType, s, actor.id]);
      await audit(q, actor, "grant.add", target.email, describe({ role: input.role, scopeType: input.scopeType, scopeId: s }));
      added++;
    }
    if (added === 0) throw new HttpError(400, "They already have that access.");
    return added;
  });
}

export async function revokeGrant(deps: AdminDeps, actor: SessionUser, grantId: string): Promise<void> {
  assertManager(actor);
  await deps.db.tx(async (q) => {
    await lockAdminChanges(q);
    const g = (await q<{ user_id: string; role: string; scope_type: string; scope_id: string | null; email: string }>(
      "select g.user_id, g.role, g.scope_type, g.scope_id, p.email from public.user_role_grants g join public.profiles p on p.id = g.user_id where g.id = $1 and g.revoked_at is null", [grantId]))[0];
    if (!g) throw new HttpError(404, "That access was already removed.");
    if (g.user_id === actor.id) throw new HttpError(403, "You cannot change your own access.");
    if (g.role === "owner_admin" && (await activeOwnersExcluding(q, g.user_id)) === 0) throw new HttpError(400, "There must always be one active owner.");
    await q("update public.user_role_grants set revoked_at = now() where id = $1", [grantId]);
    await audit(q, actor, "grant.revoke", g.email, describe({ role: g.role, scopeType: g.scope_type, scopeId: g.scope_id }));
  });
}

export async function setActive(deps: AdminDeps, actor: SessionUser, userId: string, active: boolean): Promise<void> {
  assertManager(actor);
  if (userId === actor.id) throw new HttpError(403, "You cannot deactivate yourself.");
  await deps.db.tx(async (q) => {
    await lockAdminChanges(q);
    const t = (await q<{ email: string; active: boolean }>("select email, active from public.profiles where id = $1", [userId]))[0];
    if (!t) throw new HttpError(404, "Person not found.");
    if (!active) {
      const isOwnerTarget = (await q("select 1 from public.user_role_grants where user_id = $1 and role = 'owner_admin' and revoked_at is null", [userId])).length > 0;
      if (isOwnerTarget && (await activeOwnersExcluding(q, userId)) === 0) throw new HttpError(400, "There must always be one active owner.");
    }
    await q("update public.profiles set active = $2 where id = $1", [userId, active]);
    await audit(q, actor, active ? "person.reactivate" : "person.deactivate", t.email, null);
  });
}

export async function resetPassword(deps: AdminDeps, actor: SessionUser, userId: string): Promise<{ email: string; tempPassword: string }> {
  assertManager(actor);
  if (userId === actor.id) throw new HttpError(403, "Use Account to change your own password.");
  const t = (await deps.db.query<{ email: string; active: boolean }>("select email, active from public.profiles where id = $1", [userId]))[0];
  if (!t) throw new HttpError(404, "Person not found.");
  if (!t.active) throw new HttpError(400, "Reactivate this person first.");
  const temp = tempPassword();
  await deps.auth.setPassword(userId, temp);
  await deps.db.tx(async (q) => {
    await q("update public.profiles set must_change_password = true where id = $1", [userId]);
    await audit(q, actor, "person.password_reset", t.email, null);
  });
  return { email: t.email, tempPassword: temp };
}

export async function addProperty(deps: AdminDeps, actor: SessionUser, input: { name: string; city?: string; state?: string }): Promise<string> {
  assertManager(actor);
  const name = input.name.trim();
  if (name.length < 2) throw new HttpError(400, "Enter the property name.");
  const id = slug(name);
  if (!id) throw new HttpError(400, "Enter a property name with letters or numbers.");
  const state = input.state?.trim().toUpperCase() || null;
  if (state && !/^[A-Z]{2}$/.test(state)) throw new HttpError(400, "Use a two-letter state, like KS.");
  await deps.db.tx(async (q) => {
    const org = (await q<{ org_id: string }>("select org_id from public.profiles where id = $1", [actor.id]))[0];
    if (!org) throw new HttpError(403, "Forbidden");
    const dup = await q("select 1 from public.properties where id = $1 or lower(name) = lower($2)", [id, name]);
    if (dup.length > 0) throw new HttpError(400, "A property with that name already exists.");
    await q("insert into public.properties (id, org_id, name, city, state) values ($1, $2, $3, $4, $5)", [id, org.org_id, name, input.city?.trim() || null, state]);
    await audit(q, actor, "property.add", id, name);
  });
  return id;
}

// A signed-in person changes their own password. They must give the current one.
export async function changeOwnPassword(deps: AdminDeps, user: SessionUser, current: string, next: string): Promise<void> {
  if (!user.live) throw new HttpError(403, "Forbidden");
  if (next.length < 12) throw new HttpError(400, "Use a password of at least 12 characters.");
  if (next === current) throw new HttpError(400, "Choose a password you have not used for this login.");
  if (!(await deps.auth.checkPassword(user.email, current))) throw new HttpError(400, "Your current password is not correct.");
  await deps.auth.setPassword(user.id, next);
  await deps.db.tx(async (q) => {
    await q("update public.profiles set must_change_password = false where id = $1", [user.id]);
    await audit(q, user, "password.change", user.email, null);
  });
}

export type { Grant };
