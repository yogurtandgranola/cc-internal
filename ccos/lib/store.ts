// App-local mutable state for the demo/mock harness (users, invites, audit, sync output, AI log).
// Production uses Postgres with RLS (see supabase/migrations). Fixtures are read-only and separate.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Grant, SessionUser } from "./authz";
import { DEMO_PASSWORD, SEED_USERS } from "./fixtures";
import { hashPassword } from "./password";

export type StoredUser = SessionUser & { passwordHash: string; createdAt: string; invitedBy: string | null };
export type Invite = { id: string; email: string; grants: Grant[]; tokenHash: string; expiresAt: string; status: "pending" | "accepted" | "revoked"; invitedBy: string; createdAt: string };
export type AuditEvent = { id: string; at: string; actor: string; action: string; target?: string; detail?: string; ok: boolean };
export type SourceRecord = { source: string; objectType: string; externalId: string; internalId: string | null; name: string; stage: string; url: string; lastSeenAt: string; asOf: string; projectGid: string };
export type EntityLink = { source: string; objectType: string; externalId: string; internalId: string; reviewStatus: "auto" | "confirmed"; confidence: number; reason: string };
export type ReviewItem = { id: string; source: string; externalId: string; candidates: { internalId: string; score: number }[]; name: string; createdAt: string; status: "open" | "resolved" };
export type SyncRun = { id: string; connector: string; startedAt: string; finishedAt: string; ok: boolean; fetched: number; created: number; updated: number; unchanged: number; checkpoint: string | null; errorCategory?: string };
export type AiRequest = { id: string; at: string; userId: string; provider: string; question: string; sourcesUsed: number; promptTokensEst: number; completionTokensEst: number; costUsdEst: number; outcome: "answered" | "refused" | "disabled" | "rate_limited" | "error" };
export type AiConfig = { enabled: boolean; provider: string; allowedProviders: string[]; hourlyLimitPerUser: number };

export type State = {
  users: StoredUser[]; invites: Invite[]; audit: AuditEvent[]; sourceRecords: SourceRecord[]; entityLinks: EntityLink[];
  reviewQueue: ReviewItem[]; syncRuns: SyncRun[]; aiLog: AiRequest[]; aiConfig: AiConfig; bootstrapUsed: boolean;
  kpiConfig: { collectionsPass: number; collectionsRed: number };
};

export const uid = () => crypto.randomUUID();

export function seedState(): State {
  // Hosted demo uses CCOS_DEMO_PASSWORD. Without it in production nobody can sign in (random password).
  const demoPw = process.env.CCOS_DEMO_PASSWORD || (process.env.NODE_ENV === "production" ? crypto.randomUUID() : DEMO_PASSWORD);
  const pw = hashPassword(demoPw);
  const now = new Date().toISOString();
  return {
    users: SEED_USERS.map((u) => ({ id: "u-" + u.email.split("@")[0], email: u.email, name: u.name, active: true, sessionVersion: 1, grants: u.grants, passwordHash: pw, createdAt: now, invitedBy: null })),
    invites: [], audit: [], sourceRecords: [], entityLinks: [], reviewQueue: [], syncRuns: [], aiLog: [],
    aiConfig: { enabled: true, provider: "mock", allowedProviders: ["mock"], hourlyLimitPerUser: 20 },
    bootstrapUsed: false,
    kpiConfig: { collectionsPass: 95, collectionsRed: 90 },
  };
}

export type Store = { state: State; save: () => void };

export function createStore(opts: { persist: boolean; file?: string } = { persist: false }): Store {
  const file = opts.file ?? path.join(process.cwd(), ".data", "state.json");
  let state: State = seedState();
  if (opts.persist && fs.existsSync(/*turbopackIgnore: true*/ file)) {
    try { state = { ...seedState(), ...JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) }; } catch { /* corrupt file: fall back to seed */ }
  }
  return {
    state,
    save() {
      if (!opts.persist) return;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
    },
  };
}

const g = globalThis as unknown as { __ccos_store?: Store };
export function getStore(): Store {
  if (!g.__ccos_store) g.__ccos_store = createStore({ persist: process.env.CCOS_PERSIST !== "false" && process.env.NODE_ENV !== "production" });
  return g.__ccos_store;
}
export function resetStoreForTests(persist = false) { g.__ccos_store = createStore({ persist }); return g.__ccos_store; }

export function audit(store: Store, e: Omit<AuditEvent, "id" | "at">) {
  store.state.audit.unshift({ id: uid(), at: new Date().toISOString(), ...e });
  store.state.audit = store.state.audit.slice(0, 2000);
  store.save();
}
