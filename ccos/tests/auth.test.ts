import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acceptInvite, bootstrapFirstOwner, createInvite, deactivateUser, login, resetLoginThrottle, revokeInvite, signSession, updateGrants, userFromToken } from "@/lib/auth";
import { HttpError } from "@/lib/authz";
import { DEMO_PASSWORD } from "@/lib/fixtures";
import { mk } from "./helpers";

beforeEach(() => resetLoginThrottle());
afterEach(() => { delete process.env.CCOS_BOOTSTRAP_TOKEN; });

describe("sessions", () => {
  it("logs in with correct credentials and rejects bad ones", () => {
    const { store } = mk();
    expect(login(store, "founder@demo.example", DEMO_PASSWORD)?.token).toBeTruthy();
    expect(login(store, "founder@demo.example", "wrong")).toBeNull();
    expect(login(store, "nobody@demo.example", "x")).toBeNull();
  });
  it("throttles repeated failures", () => {
    const { store } = mk();
    for (let i = 0; i < 5; i++) login(store, "ops@demo.example", "bad");
    expect(login(store, "ops@demo.example", DEMO_PASSWORD)).toBeNull();
  });
  it("rejects tampered and expired tokens", () => {
    const { store, u } = mk();
    const t = signSession(u("founder"));
    expect(userFromToken(store, t)?.id).toBe(u("founder").id);
    expect(userFromToken(store, t.slice(0, -2) + "xx")).toBeNull();
    expect(userFromToken(store, signSession(u("founder"), -10))).toBeNull();
    expect(userFromToken(store, "garbage")).toBeNull();
    expect(userFromToken(store, undefined)).toBeNull();
  });
  it("mock auth is refused in production", () => {
    const { store } = mk();
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(() => login(store, "founder@demo.example", DEMO_PASSWORD)).toThrow(/disabled/);
    (process.env as Record<string, string>).NODE_ENV = prev ?? "test";
  });
});

describe("external VA invited from any email domain (demo 5)", () => {
  it("invite, accept, then deactivation denies the old token immediately", () => {
    const { store, u } = mk();
    const founder = u("founder");
    const { token } = createInvite(store, founder, "Helper@gmail.com", [{ role: "external_contractor", scopeType: "property", scopeId: "p-cedar" }]);
    const va = acceptInvite(store, token, "Virtual Assistant", "a-long-passphrase-1");
    expect(va.email).toBe("helper@gmail.com");
    const session = login(store, "helper@gmail.com", "a-long-passphrase-1")!;
    expect(userFromToken(store, session.token)?.id).toBe(va.id);
    deactivateUser(store, founder, va.id);
    expect(userFromToken(store, session.token)).toBeNull();
    expect(login(store, "helper@gmail.com", "a-long-passphrase-1")).toBeNull();
  });
  it("invite tokens are single use and revocable", () => {
    const { store, u } = mk();
    const { token, invite } = createInvite(store, u("founder"), "a@b.co", [{ role: "restricted_viewer", scopeType: "org", scopeId: null }]);
    acceptInvite(store, token, "A", "a-long-passphrase-1");
    expect(() => acceptInvite(store, token, "A", "a-long-passphrase-1")).toThrow(HttpError);
    const second = createInvite(store, u("founder"), "c@d.co", [{ role: "restricted_viewer", scopeType: "org", scopeId: null }]);
    revokeInvite(store, u("founder"), second.invite.id);
    expect(() => acceptInvite(store, second.token, "C", "a-long-passphrase-1")).toThrow(HttpError);
    expect(invite.status).toBe("accepted");
  });
  it("stores only a hash of the invite token", () => {
    const { store, u } = mk();
    const { token } = createInvite(store, u("founder"), "x@y.co", [{ role: "restricted_viewer", scopeType: "org", scopeId: null }]);
    expect(JSON.stringify(store.state.invites)).not.toContain(token);
  });
});

describe("privilege controls", () => {
  it("non-admins cannot invite, deactivate or edit grants", () => {
    const { store, u } = mk();
    const g = [{ role: "restricted_viewer" as const, scopeType: "org" as const, scopeId: null }];
    expect(() => createInvite(store, u("ops"), "z@z.co", g)).toThrow(/Forbidden/);
    expect(() => deactivateUser(store, u("ops"), u("founder").id)).toThrow(/Forbidden/);
    expect(() => updateGrants(store, u("pm"), u("ops").id, g)).toThrow(/Forbidden/);
  });
  it("nobody can edit their own grants or deactivate themselves", () => {
    const { store, u } = mk();
    expect(() => updateGrants(store, u("founder"), u("founder").id, [])).toThrow(/own grants/);
    expect(() => deactivateUser(store, u("founder"), u("founder").id)).toThrow(/own account/);
  });
  it("changing grants invalidates the user's existing sessions", () => {
    const { store, u } = mk();
    const t = signSession(u("ops"));
    updateGrants(store, u("founder"), u("ops").id, [{ role: "restricted_viewer", scopeType: "org", scopeId: null }]);
    expect(userFromToken(store, t)).toBeNull();
  });
  it("audit records the changes", () => {
    const { store, u } = mk();
    deactivateUser(store, u("founder"), u("pm").id);
    expect(store.state.audit[0]?.action).toBe("user.deactivate");
  });
});

describe("first-owner bootstrap", () => {
  it("is refused when an owner exists", () => {
    const { store } = mk();
    process.env.CCOS_BOOTSTRAP_TOKEN = "x".repeat(32);
    expect(() => bootstrapFirstOwner(store, "x".repeat(32), "a@b.co", "A", "a-long-passphrase-1")).toThrow(/owner already exists/);
  });
  it("needs the operator token, works once, then locks", () => {
    const { store } = mk();
    store.state.users = [];
    expect(() => bootstrapFirstOwner(store, "anything", "a@b.co", "A", "a-long-passphrase-1")).toThrow(/not enabled/);
    process.env.CCOS_BOOTSTRAP_TOKEN = "t".repeat(32);
    expect(() => bootstrapFirstOwner(store, "wrong".padEnd(32, "w"), "a@b.co", "A", "a-long-passphrase-1")).toThrow(/Invalid/);
    bootstrapFirstOwner(store, "t".repeat(32), "a@b.co", "A", "a-long-passphrase-1");
    expect(() => bootstrapFirstOwner(store, "t".repeat(32), "c@d.co", "C", "a-long-passphrase-1")).toThrow(/owner already exists/);
  });
});
