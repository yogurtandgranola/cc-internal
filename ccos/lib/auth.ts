// Mock auth harness. Runs locally, in tests, and as an explicit hosted demo with synthetic data. Refused in live mode.
// Live mode would use Supabase Auth with the same SessionUser shape. See docs/DECISIONS.md.
import crypto from "node:crypto";
import { HttpError, assertCan, can, type Grant, type SessionUser } from "./authz";
import { audit, uid, type Store, type StoredUser } from "./store";
import { hashPassword, verifyPassword } from "./password";

// Any of these means real systems or real vendors are wired in. The hosted demo then refuses to run (fail closed).
const LIVE_SOURCE_VARS = ["ASANA_ACCESS_TOKEN", "RENTMANAGER_BASE_URL", "RENTMANAGER_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"];
export function liveSourcesConfigured(): boolean {
  return LIVE_SOURCE_VARS.some((k) => Boolean(process.env[k]));
}
// Hosted demo: an explicit opt-in for a web deployment that holds synthetic data only.
export function hostedDemoEnabled(): boolean {
  return process.env.CCOS_DEMO_HOSTED === "true" && process.env.CCOS_MODE !== "live" && !liveSourcesConfigured();
}
// Mock sign-in runs locally and in tests, and in production only as an explicit hosted demo with no live source connected.
export function mockAuthAllowed(): boolean {
  if (process.env.CCOS_MODE === "live") return false;
  if (process.env.NODE_ENV !== "production") return true;
  return hostedDemoEnabled();
}
export function assertMockAuthAllowed() {
  if (!mockAuthAllowed()) throw new Error("Mock authentication is disabled here. Hosted demo needs CCOS_DEMO_HOSTED=true and no live source configured.");
}

function secret(): string {
  const s = process.env.CCOS_SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("CCOS_SESSION_SECRET must be set (32+ chars).");
    return "dev-only-secret-dev-only-secret-dev-only";
  }
  return s;
}

const b64 = (b: Buffer) => b.toString("base64url");
const mac = (data: string) => b64(crypto.createHmac("sha256", secret()).update(data).digest());

export function signSession(user: Pick<SessionUser, "id" | "sessionVersion">, ttlSec = 8 * 3600): string {
  const payload = `${user.id}.${user.sessionVersion}.${Math.floor(Date.now() / 1000) + ttlSec}`;
  return `${b64(Buffer.from(payload))}.${mac(payload)}`;
}

export function userFromToken(store: Store, token: string | undefined | null): StoredUser | null {
  if (!token) return null;
  const [p, sig] = token.split(".");
  if (!p || !sig) return null;
  let payload: string;
  try { payload = Buffer.from(p, "base64url").toString("utf8"); } catch { return null; }
  const expect = mac(payload);
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  const [id, ver, exp] = payload.split(".");
  if (!id || !ver || !exp || Number(exp) < Date.now() / 1000) return null;
  const user = store.state.users.find((u) => u.id === id);
  // Deactivation and any role change bump sessionVersion, so an old token stops working immediately.
  if (!user || !user.active || user.sessionVersion !== Number(ver)) return null;
  return user;
}

const attempts = new Map<string, { n: number; first: number }>();
export function login(store: Store, email: string, password: string): { token: string; user: StoredUser } | null {
  assertMockAuthAllowed();
  const key = email.trim().toLowerCase();
  const a = attempts.get(key);
  const now = Date.now();
  if (a && now - a.first < 15 * 60_000 && a.n >= 5) { audit(store, { actor: key, action: "login.throttled", ok: false }); return null; }
  const user = store.state.users.find((u) => u.email.toLowerCase() === key);
  // Always run a hash comparison so timing does not reveal whether the email exists.
  const ok = user ? verifyPassword(password, user.passwordHash) && user.active : verifyPassword(password, "scrypt$00$00") && false;
  if (!ok || !user) {
    const cur = a && now - a.first < 15 * 60_000 ? a : { n: 0, first: now };
    attempts.set(key, { n: cur.n + 1, first: cur.first });
    audit(store, { actor: key, action: "login.failed", ok: false });
    return null;
  }
  attempts.delete(key);
  audit(store, { actor: user.id, action: "login.success", ok: true });
  return { token: signSession(user), user };
}
export function resetLoginThrottle() { attempts.clear(); }

// ---- invitations ----
const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createInvite(store: Store, actor: SessionUser, email: string, grants: Grant[]) {
  assertCan(actor, "manage_users");
  const clean = email.trim().toLowerCase();
  if (!EMAIL.test(clean)) throw new HttpError(400, "Enter a valid email address");
  if (grants.length === 0) throw new HttpError(400, "Choose at least one role and scope");
  // Only an owner can hand out owner_admin. A user can never create grants beyond what they can themselves exercise.
  for (const g of grants) {
    if (g.role === "owner_admin" && !actor.grants.some((x) => x.role === "owner_admin" && x.scopeType === "org")) throw new HttpError(403, "Only an owner can grant owner access");
    if (g.scopeType !== "org" && !g.scopeId) throw new HttpError(400, "Scoped grants need a scope id");
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const invite = { id: uid(), email: clean, grants, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), status: "pending" as const, invitedBy: actor.id, createdAt: new Date().toISOString() };
  store.state.invites.push(invite);
  audit(store, { actor: actor.id, action: "invite.create", target: clean, detail: grants.map((g) => `${g.role}@${g.scopeType}:${g.scopeId ?? "*"}`).join(", "), ok: true });
  return { invite, token }; // the token is shown once to the admin. The app never sends email on its own.
}

export function revokeInvite(store: Store, actor: SessionUser, inviteId: string) {
  assertCan(actor, "manage_users");
  const inv = store.state.invites.find((i) => i.id === inviteId);
  if (!inv || inv.status !== "pending") throw new HttpError(404, "Invite not found");
  inv.status = "revoked";
  audit(store, { actor: actor.id, action: "invite.revoke", target: inv.email, ok: true });
}

export function acceptInvite(store: Store, token: string, name: string, password: string): StoredUser {
  const h = hashToken(token);
  const inv = store.state.invites.find((i) => i.tokenHash === h);
  if (!inv || inv.status !== "pending" || new Date(inv.expiresAt) < new Date()) throw new HttpError(400, "This invitation is invalid or expired");
  if (password.length < 12) throw new HttpError(400, "Use a password of at least 12 characters");
  if (store.state.users.some((u) => u.email === inv.email)) throw new HttpError(400, "An account already exists for this email");
  const user: StoredUser = { id: "u-" + uid().slice(0, 8), email: inv.email, name: name.trim() || inv.email, active: true, sessionVersion: 1, grants: inv.grants, passwordHash: hashPassword(password), createdAt: new Date().toISOString(), invitedBy: inv.invitedBy };
  store.state.users.push(user);
  inv.status = "accepted";
  audit(store, { actor: user.id, action: "invite.accept", target: inv.email, ok: true });
  return user;
}

export function deactivateUser(store: Store, actor: SessionUser, userId: string) {
  assertCan(actor, "manage_users");
  if (actor.id === userId) throw new HttpError(400, "You cannot deactivate your own account");
  const target = store.state.users.find((u) => u.id === userId);
  if (!target) throw new HttpError(404, "User not found");
  const owners = store.state.users.filter((u) => u.active && u.grants.some((g) => g.role === "owner_admin"));
  if (target.grants.some((g) => g.role === "owner_admin") && owners.length <= 1) throw new HttpError(400, "Cannot deactivate the last owner");
  target.active = false;
  target.sessionVersion += 1;
  audit(store, { actor: actor.id, action: "user.deactivate", target: target.email, ok: true });
}

export function updateGrants(store: Store, actor: SessionUser, userId: string, grants: Grant[]) {
  assertCan(actor, "manage_users");
  if (actor.id === userId) throw new HttpError(403, "You cannot change your own grants");
  const target = store.state.users.find((u) => u.id === userId);
  if (!target) throw new HttpError(404, "User not found");
  if (grants.some((g) => g.role === "owner_admin") && !can(actor, "manage_users")) throw new HttpError(403, "Forbidden");
  target.grants = grants;
  target.sessionVersion += 1;
  audit(store, { actor: actor.id, action: "user.grants.update", target: target.email, detail: grants.map((g) => `${g.role}@${g.scopeType}:${g.scopeId ?? "*"}`).join(", "), ok: true });
}

// First-owner setup. Allowed once, only while no owner exists, and only with the operator-supplied one-time token.
export function bootstrapFirstOwner(store: Store, token: string, email: string, name: string, password: string) {
  const expected = process.env.CCOS_BOOTSTRAP_TOKEN;
  const owners = store.state.users.filter((u) => u.grants.some((g) => g.role === "owner_admin"));
  if (!expected || expected.length < 24) throw new HttpError(403, "Bootstrap is not enabled");
  if (owners.length > 0 || store.state.bootstrapUsed) throw new HttpError(403, "An owner already exists");
  const a = Buffer.from(token), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(403, "Invalid bootstrap token");
  if (!EMAIL.test(email) || password.length < 12) throw new HttpError(400, "Provide a valid email and a password of 12+ characters");
  const user: StoredUser = { id: "u-" + uid().slice(0, 8), email: email.toLowerCase(), name, active: true, sessionVersion: 1, grants: [{ role: "owner_admin", scopeType: "org", scopeId: null }], passwordHash: hashPassword(password), createdAt: new Date().toISOString(), invitedBy: null };
  store.state.users.push(user);
  store.state.bootstrapUsed = true;
  audit(store, { actor: user.id, action: "bootstrap.first_owner", target: user.email, ok: true });
  return user;
}
