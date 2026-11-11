import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { liveAuthConfigured, liveLogin, liveUserFromToken, resetLiveThrottle, signLiveToken, type Db, type LiveDeps } from "@/lib/live-auth";
import { can } from "@/lib/authz";

// A tiny fake of Supabase Auth and of our three tables. It answers only the SQL this module sends.
type Row = Record<string, unknown>;
function fake(opts: { password?: string; authId?: string; env?: Record<string, string> } = {}) {
  const state = { profiles: [] as Row[], grants: [] as Row[], orgs: [] as Row[], audit: [] as Row[], properties: [] as Row[], now: 1_800_000_000_000 };
  const exec = async (sql: string, p: unknown[] = []): Promise<Row[]> => {
    if (sql.includes("from public.profiles where id")) return state.profiles.filter((x) => x.id === p[0]);
    if (sql.includes("from public.user_role_grants where user_id")) return state.grants.filter((x) => x.user_id === p[0] && !x.revoked_at);
    if (sql.includes("where g.role = 'owner_admin'")) return state.grants.filter((g) => g.role === "owner_admin" && !g.revoked_at && state.profiles.some((x) => x.id === g.user_id && x.active)).slice(0, 1);
    if (sql.includes("from public.organizations")) return state.orgs.slice(0, 1);
    if (sql.includes("insert into public.organizations")) { state.orgs.push({ id: "org1" }); return [{ id: "org1" }]; }
    if (sql.includes("insert into public.profiles")) { if (!state.profiles.some((x) => x.id === p[0])) state.profiles.push({ id: p[0], org_id: p[1], email: p[2], name: p[3], active: true }); return []; }
    if (sql.includes("insert into public.user_role_grants")) { state.grants.push({ user_id: p[0], role: "owner_admin", scope_type: "org", scope_id: null }); return []; }
    if (sql.includes("from public.properties")) return [{ n: state.properties.length }];
    if (sql.includes("insert into public.properties")) { state.properties.push({ id: p[0] }); return []; }
    if (sql.includes("insert into public.audit_events")) { state.audit.push({ args: p }); return []; }
    throw new Error("unexpected sql: " + sql);
  };
  const db: Db = { query: exec as Db["query"], tx: async (fn) => fn(exec as Db["query"]) };
  const calls: string[] = [];
  const fetcher = (async (url: string, init: { body: string }) => {
    calls.push(url);
    const { email, password } = JSON.parse(init.body);
    if (password !== (opts.password ?? "right-password-123")) return new Response("{}", { status: 400 });
    return new Response(JSON.stringify({ user: { id: opts.authId ?? "auth-1", email } }), { status: 200 });
  }) as unknown as typeof fetch;
  const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_PUBLISHABLE_KEY: "pk", POSTGRES_URL: "postgres://x", ...(opts.env ?? {}) };
  const deps: LiveDeps = { fetch: fetcher, db, env, now: () => state.now };
  return { state, deps, calls };
}
const addUser = (s: ReturnType<typeof fake>["state"], id: string, role: string, scope: [string, string | null] = ["org", null], active = true) => {
  s.profiles.push({ id, org_id: "org1", email: `${id}@x.test`, name: id, active });
  s.grants.push({ user_id: id, role, scope_type: scope[0], scope_id: scope[1] });
};

const SECRET = process.env.CCOS_SESSION_SECRET;
beforeEach(() => { process.env.CCOS_SESSION_SECRET = "x".repeat(40); resetLiveThrottle(); });
afterEach(() => { if (SECRET === undefined) delete process.env.CCOS_SESSION_SECRET; else process.env.CCOS_SESSION_SECRET = SECRET; });

describe("real sign-in", () => {
  it("needs Supabase and a database to be configured", () => {
    expect(liveAuthConfigured({})).toBe(false);
    expect(liveAuthConfigured({ SUPABASE_URL: "u", SUPABASE_PUBLISHABLE_KEY: "k" })).toBe(false);
    expect(liveAuthConfigured({ NEXT_PUBLIC_SUPABASE_URL: "u", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "k", POSTGRES_URL: "p" })).toBe(true);
  });

  it("signs in a user who has a profile and a grant, and the cookie works", async () => {
    const f = fake({ authId: "ops1" });
    addUser(f.state, "ops1", "ops_manager", ["department", "operations"]);
    f.state.profiles[0]!.email = "loren@x.test";
    const r = await liveLogin("Loren@X.test", "right-password-123", f.deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.user.grants[0]?.role).toBe("ops_manager");
    expect(can(r.user, "view_investor_pii")).toBe(false);
    expect((await liveUserFromToken(r.token, f.deps))?.id).toBe("ops1");
  });

  it("rejects a wrong password and counts it toward a lockout", async () => {
    const f = fake();
    addUser(f.state, "auth-1", "ops_manager", ["department", "operations"]);
    for (let i = 0; i < 5; i++) expect(await liveLogin("a@x.test", "nope", f.deps)).toEqual({ ok: false, reason: "invalid" });
    expect(await liveLogin("a@x.test", "right-password-123", f.deps)).toEqual({ ok: false, reason: "throttled" });
  });

  it("default deny: a valid login with no profile gets no access", async () => {
    const f = fake({ authId: "stranger" });
    expect(await liveLogin("stranger@x.test", "right-password-123", f.deps)).toEqual({ ok: false, reason: "no_access" });
    expect(f.state.profiles).toEqual([]);
  });

  it("a switched-off person is told so, not that they have no access yet", async () => {
    const f = fake({ authId: "off1" });
    addUser(f.state, "off1", "ops_staff", ["department", "operations"], false);
    expect(await liveLogin("off1@x.test", "right-password-123", f.deps)).toEqual({ ok: false, reason: "switched_off" });
  });

  it("demo addresses never go to Supabase", async () => {
    const f = fake();
    expect(await liveLogin("founder@demo.example", "right-password-123", f.deps)).toEqual({ ok: false, reason: "invalid" });
    expect(f.calls).toEqual([]);
  });

  it("the owner email becomes owner on first sign-in, once", async () => {
    const f = fake({ authId: "leo-id", env: { CCOS_OWNER_EMAIL: "Leo@Cornell.test" } });
    const r = await liveLogin("leo@cornell.test", "right-password-123", f.deps);
    expect(r.ok && r.user.grants).toEqual([{ role: "owner_admin", scopeType: "org", scopeId: null }]);
    // A different person with the right password but the wrong email gets nothing, even though an owner env var exists.
    const g = fake({ authId: "other", env: { CCOS_OWNER_EMAIL: "leo@cornell.test" } });
    expect(await liveLogin("other@cornell.test", "right-password-123", g.deps)).toEqual({ ok: false, reason: "no_access" });
    // After an owner exists, the env var grants nothing new.
    const h = fake({ authId: "second", env: { CCOS_OWNER_EMAIL: "second@x.test" } });
    addUser(h.state, "existing-owner", "owner_admin");
    expect(await liveLogin("second@x.test", "right-password-123", h.deps)).toEqual({ ok: false, reason: "no_access" });
  });

  it("deactivating a user or changing a grant ends the session on the next request", async () => {
    const f = fake({ authId: "u1" });
    addUser(f.state, "u1", "ops_staff", ["department", "operations"]);
    const r = await liveLogin("u1@x.test", "right-password-123", f.deps);
    if (!r.ok) throw new Error("expected sign-in");
    expect(await liveUserFromToken(r.token, f.deps)).not.toBeNull();
    f.state.grants[0]!.role = "ops_manager";
    expect(await liveUserFromToken(r.token, f.deps)).toBeNull();
    f.state.grants[0]!.role = "ops_staff";
    expect(await liveUserFromToken(r.token, f.deps)).not.toBeNull();
    f.state.profiles[0]!.active = false;
    expect(await liveUserFromToken(r.token, f.deps)).toBeNull();
  });

  it("rejects forged, tampered and expired tokens", async () => {
    const f = fake({ authId: "u1" });
    addUser(f.state, "u1", "ops_staff", ["department", "operations"]);
    const r = await liveLogin("u1@x.test", "right-password-123", f.deps);
    if (!r.ok) throw new Error("expected sign-in");
    expect(await liveUserFromToken(r.token.slice(0, -2) + "xx", f.deps)).toBeNull();
    expect(await liveUserFromToken("L1.abc.def", f.deps)).toBeNull();
    expect(await liveUserFromToken("not-a-live-token", f.deps)).toBeNull();
    const old = signLiveToken(r.user, f.state.now - 9 * 3600 * 1000);
    expect(await liveUserFromToken(old, f.deps)).toBeNull();
  });

  it("an unavailable database means not signed in, never signed in", async () => {
    const f = fake({ authId: "u1" });
    addUser(f.state, "u1", "ops_staff", ["department", "operations"]);
    const r = await liveLogin("u1@x.test", "right-password-123", f.deps);
    if (!r.ok) throw new Error("expected sign-in");
    const broken: LiveDeps = { ...f.deps, db: { query: async () => { throw new Error("down"); }, tx: async () => { throw new Error("down"); } } };
    expect(await liveUserFromToken(r.token, broken)).toBeNull();
  });
});
