// Runs against a real Postgres (see scripts/test-db.sh). Skipped when CCOS_TEST_DB_URL is not set.
import crypto from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { liveLogin, liveUserFromToken, resetLiveThrottle, type Db, type LiveDeps } from "@/lib/live-auth";
import { addGrants, addPerson, addProperty, changeOwnPassword, listPeople, listPropertyChoices, recentAudit, resetPassword, revokeGrant, setActive, validateGrant, type AdminDeps, type AuthAdmin } from "@/lib/live-admin";
import { pgConfig } from "@/lib/pg-config";
import type { SessionUser } from "@/lib/authz";

const URL = process.env.CCOS_TEST_DB_URL;
const OWNER = "owner@cornell.test";
let pool: pg.Pool;
let db: Db;
let auth: AuthAdmin;
const passwords = new Map<string, { id: string; password: string }>();
const rejects = async (p: Promise<unknown>, re: RegExp) => { await expect(p).rejects.toThrow(re); };

function makeDb(p: pg.Pool): Db {
  const query: Db["query"] = async (sql, params = []) => (await p.query(sql, params as unknown[])).rows;
  return {
    query,
    async tx(fn) {
      const c = await p.connect();
      try { await c.query("begin"); const out = await fn(async (sql, params = []) => (await c.query(sql, params as unknown[])).rows); await c.query("commit"); return out; }
      catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
    },
  };
}
async function newAuthUser(email: string, password: string): Promise<string> {
  const id = crypto.randomUUID();
  await pool.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  passwords.set(email, { id, password });
  return id;
}
const fakeFetch = (async (_url: string, init: { body: string }) => {
  const { email, password } = JSON.parse(init.body);
  const u = passwords.get(email);
  if (!u || u.password !== password) return new Response("{}", { status: 400 });
  return new Response(JSON.stringify({ user: { id: u.id, email } }), { status: 200 });
}) as unknown as typeof fetch;
const deps = (extra: Record<string, string> = {}): LiveDeps => ({ fetch: fakeFetch, db, env: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_PUBLISHABLE_KEY: "pk", POSTGRES_URL: "postgres://x", CCOS_OWNER_EMAIL: OWNER, ...extra }, now: () => Date.now() });
const asUser = (u: SessionUser) => u;

describe.skipIf(!URL)("people and permissions on a real database", () => {
  let owner: SessionUser;
  let admin: AdminDeps;
  const secret = process.env.CCOS_SESSION_SECRET;

  beforeAll(async () => {
    process.env.CCOS_SESSION_SECRET = "y".repeat(40);
    pool = new pg.Pool(pgConfig(URL!));
    db = makeDb(pool);
    auth = {
      async createUser(email, password) { const id = await newAuthUser(email, password); return id; },
      async setPassword(userId, password) { for (const [e, v] of passwords) if (v.id === userId) passwords.set(e, { id: userId, password }); },
      async checkPassword(email, password) { return passwords.get(email)?.password === password; },
    };
    admin = { db, auth };
    await newAuthUser(OWNER, "owner-password-123");
  });
  afterAll(async () => { if (secret === undefined) delete process.env.CCOS_SESSION_SECRET; else process.env.CCOS_SESSION_SECRET = secret; await pool.end(); });

  it("first sign-in by the owner email makes the owner, the org and the property list", async () => {
    resetLiveThrottle();
    const r = await liveLogin(OWNER, "owner-password-123", deps());
    if (!r.ok) throw new Error("expected owner sign-in, got " + r.reason);
    owner = r.user;
    expect(owner.grants).toEqual([{ role: "owner_admin", scopeType: "org", scopeId: null }]);
    expect(owner.live).toBe(true);
    const props = await listPropertyChoices(owner, db);
    expect(props.length).toBe(11);
    expect(props.map((p) => p.name)).toContain("Lincoln Park MH/RV");
    // a second sign-in does not create another owner or reseed
    const again = await liveLogin(OWNER, "owner-password-123", deps());
    expect(again.ok).toBe(true);
    expect((await listPropertyChoices(owner, db)).length).toBe(11);
  });

  it("adds ops staff limited to two properties, with a temporary password they must change", async () => {
    const r = await addPerson(admin, owner, { email: "Chelsea@Cornell.test", name: "Chelsea", role: "ops_staff", scopeType: "property", scopeIds: ["lincoln-park", "emporia"] });
    expect(r.tempPassword).toMatch(/^[A-Za-z0-9_-]{16}$/);
    const people = await listPeople(owner, db);
    const chelsea = people.find((p) => p.email === "chelsea@cornell.test")!;
    expect(chelsea.mustChangePassword).toBe(true);
    expect(chelsea.grants.map((g) => `${g.role}@${g.scopeType}:${g.scopeId}`).sort()).toEqual(["ops_staff@property:emporia", "ops_staff@property:lincoln-park"]);
    // the temporary password works once and the sign-in carries the property limits and the change-password flag
    const login = await liveLogin("chelsea@cornell.test", r.tempPassword!, deps());
    if (!login.ok) throw new Error("expected sign-in");
    expect(login.user.mustChangePassword).toBe(true);
    expect(login.user.grants.every((g) => g.scopeType === "property")).toBe(true);
    await rejects(addPerson(admin, owner, { email: "chelsea@cornell.test", name: "Chelsea", role: "ops_staff", scopeType: "property", scopeIds: ["emporia"] }), /already has access/);
  });

  it("the temporary password is not stored anywhere in the database", async () => {
    const r = await addPerson(admin, owner, { email: "vicky@cornell.test", name: "Vicky", role: "ops_staff", scopeType: "property", scopeIds: ["sunflower-estates"] });
    const dump = JSON.stringify([(await pool.query("select * from public.profiles")).rows, (await pool.query("select * from public.audit_events")).rows, (await pool.query("select * from public.user_role_grants")).rows]);
    expect(dump).not.toContain(r.tempPassword!);
  });

  it("coordinator roles can be given, and only at sensible scopes", async () => {
    await addPerson(admin, owner, { email: "va@cornell.test", name: "VA", role: "acquisitions_coordinator", scopeType: "department", scopeIds: ["acquisitions"] });
    await addPerson(admin, owner, { email: "irc@cornell.test", name: "IR Coord", role: "ir_coordinator", scopeType: "department", scopeIds: ["ir"] });
    await rejects(validateGrant(db.query, "ops_staff", "deal", "x"), /cannot be limited that way/);
    await rejects(validateGrant(db.query, "acquisitions_coordinator", "department", "operations"), /belongs to the acquisitions department/);
    await rejects(validateGrant(db.query, "ir_coordinator", "property", "emporia"), /cannot be limited that way/);
    await rejects(validateGrant(db.query, "ops_staff", "property", "not-a-property"), /Unknown property/);
    await rejects(validateGrant(db.query, "owner_admin", "department", "operations"), /cannot be limited that way/);
    await rejects(validateGrant(db.query, "owner_admin", "org", "x"), /no scope/);
    await rejects(validateGrant(db.query, "ops_staff", "property", null), /Choose where/);
    await rejects(validateGrant(db.query, "ghost_role", "org", null), /Choose a role/);
    await rejects(validateGrant(db.query, "external_pm", "deal", "d1"), /cannot be limited that way/);
  });

  it("adds, dedupes and removes access", async () => {
    const people = await listPeople(owner, db);
    const chelsea = people.find((p) => p.email === "chelsea@cornell.test")!;
    expect(await addGrants(admin, owner, chelsea.id, { role: "ops_staff", scopeType: "property", scopeIds: ["sunflower-estates", "emporia"] })).toBe(1); // emporia already held
    await rejects(addGrants(admin, owner, chelsea.id, { role: "ops_staff", scopeType: "property", scopeIds: ["emporia"] }), /already have that access/);
    const after = (await listPeople(owner, db)).find((p) => p.id === chelsea.id)!;
    const sun = after.grants.find((g) => g.scopeId === "sunflower-estates")!;
    await revokeGrant(admin, owner, sun.id);
    await rejects(revokeGrant(admin, owner, sun.id), /already removed/);
    expect((await listPeople(owner, db)).find((p) => p.id === chelsea.id)!.grants.length).toBe(2);
  });

  it("a role change or deactivation ends the person's session on the next request", async () => {
    const login = await liveLogin("va@cornell.test", passwords.get("va@cornell.test")!.password, deps());
    if (!login.ok) throw new Error("expected sign-in");
    expect(await liveUserFromToken(login.token, deps())).not.toBeNull();
    const va = (await listPeople(owner, db)).find((p) => p.email === "va@cornell.test")!;
    await addGrants(admin, owner, va.id, { role: "restricted_viewer", scopeType: "property", scopeIds: ["emporia"] });
    expect(await liveUserFromToken(login.token, deps())).toBeNull(); // grants changed
    const login2 = await liveLogin("va@cornell.test", passwords.get("va@cornell.test")!.password, deps());
    if (!login2.ok) throw new Error("expected sign-in");
    expect(await liveUserFromToken(login2.token, deps())).not.toBeNull();
    await setActive(admin, owner, va.id, false);
    expect(await liveUserFromToken(login2.token, deps())).toBeNull();
    expect((await liveLogin("va@cornell.test", passwords.get("va@cornell.test")!.password, deps())).ok).toBe(false);
    await setActive(admin, owner, va.id, true);
    expect((await liveLogin("va@cornell.test", passwords.get("va@cornell.test")!.password, deps())).ok).toBe(true);
  });

  it("nobody changes their own access, and only an owner can create an owner", async () => {
    await rejects(addGrants(admin, owner, owner.id, { role: "ops_manager", scopeType: "department", scopeIds: ["operations"] }), /own access/);
    await rejects(setActive(admin, owner, owner.id, false), /yourself/);
    await rejects(resetPassword(admin, owner, owner.id), /Account/);
    const ownerGrant = (await listPeople(owner, db)).find((p) => p.id === owner.id)!.grants[0]!;
    await rejects(revokeGrant(admin, owner, ownerGrant.id), /own access/);
    const nonOwnerManager: SessionUser = { ...owner, id: crypto.randomUUID(), grants: [{ role: "ops_manager", scopeType: "department", scopeId: "operations" }] };
    await rejects(addPerson(admin, nonOwnerManager, { email: "x@cornell.test", name: "X", role: "ops_staff", scopeType: "department", scopeIds: ["operations"] }), /Forbidden/);
    await rejects(listPeople(nonOwnerManager, db), /Forbidden/);
    const demoLike: SessionUser = { ...owner, live: undefined };
    await rejects(listPeople(demoLike, db), /Forbidden/);
  });

  it("there is always one active owner", async () => {
    const second = await addPerson(admin, owner, { email: "second@cornell.test", name: "Second", role: "owner_admin", scopeType: "org", scopeIds: [] });
    const people = await listPeople(owner, db);
    const secondGrant = people.find((p) => p.id === second.userId)!.grants[0]!;
    // an acting manager who is not the owner in the database tries to remove the only other owner path
    const ghost: SessionUser = { ...owner, id: crypto.randomUUID() };
    await revokeGrant(admin, owner, secondGrant.id); // owner remains, fine
    await addGrants(admin, owner, second.userId, { role: "owner_admin", scopeType: "org", scopeIds: [] });
    await setActive(admin, owner, second.userId, false); // owner remains, fine
    // now only the owner is active. A ghost manager (session says owner, database says no) cannot remove the last one.
    const ownerGrant = (await listPeople(owner, db)).find((p) => p.id === owner.id)!.grants[0]!;
    await rejects(revokeGrant(admin, ghost, ownerGrant.id), /one active owner/);
    await rejects(setActive(admin, ghost, owner.id, false), /one active owner/);
  });

  it("password reset gives a new temporary password and forces a change; people change their own", async () => {
    const vicky = (await listPeople(owner, db)).find((p) => p.email === "vicky@cornell.test")!;
    const r = await resetPassword(admin, owner, vicky.id);
    expect(r.tempPassword).toHaveLength(16);
    const login = await liveLogin("vicky@cornell.test", r.tempPassword, deps());
    if (!login.ok) throw new Error("expected sign-in with the reset password");
    expect(login.user.mustChangePassword).toBe(true);
    await rejects(changeOwnPassword(admin, login.user, "wrong-current-pw", "a-brand-new-password-1"), /current password/);
    await rejects(changeOwnPassword(admin, login.user, r.tempPassword, "short"), /12 characters/);
    await rejects(changeOwnPassword(admin, login.user, r.tempPassword, r.tempPassword), /not used/);
    await changeOwnPassword(admin, login.user, r.tempPassword, "a-brand-new-password-1");
    const again = await liveLogin("vicky@cornell.test", "a-brand-new-password-1", deps());
    if (!again.ok) throw new Error("expected sign-in with the new password");
    expect(again.user.mustChangePassword).toBe(false);
    expect((await liveLogin("vicky@cornell.test", r.tempPassword, deps())).ok).toBe(false);
    await rejects(resetPassword(admin, owner, crypto.randomUUID()), /not found/);
  });

  it("adds properties and refuses duplicates and bad states", async () => {
    expect(await addProperty(admin, owner, { name: "Green Valley Estates", city: "Hallstead", state: "pa" })).toBe("green-valley-estates");
    await rejects(addProperty(admin, owner, { name: "green valley estates" }), /already exists/);
    await rejects(addProperty(admin, owner, { name: "Bad State", state: "Kansas" }), /two-letter/);
    await rejects(addProperty(admin, owner, { name: "x" }), /property name/);
    expect((await listPropertyChoices(owner, db)).some((p) => p.id === "green-valley-estates" && p.state === "PA")).toBe(true);
  });

  it("every change is in the audit log", async () => {
    const log = await recentAudit(owner, db, 100);
    const actions = new Set(log.map((l) => l.action));
    for (const a of ["bootstrap.first_owner", "login.success", "person.add", "grant.add", "grant.revoke", "person.deactivate", "person.reactivate", "person.password_reset", "password.change", "property.add"]) expect(actions, a).toContain(a);
    expect(log.some((l) => l.who === OWNER)).toBe(true);
    expect(asUser(owner).grants.length).toBe(1);
  });
});
