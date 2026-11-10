// Idempotent read-only sync of Asana-like records into source_records / entity_links.
// Never merges by name alone: only an explicit crosswalk key auto-links. Name similarity goes to human review.
import { DEALS } from "./fixtures";
import type { AsanaRecord } from "./types";
import type { Connector } from "./connectors/types";
import { audit, uid, type Store, type SyncRun } from "./store";

const norm = (s: string) => s.toLowerCase().replace(/\(demo\)|\bdemo\b|\bmhc\b|\bmhp\b/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
export function similarity(a: string, b: string): number {
  const A = new Set(norm(a)), B = new Set(norm(b));
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

async function withRetry<T>(fn: () => Promise<T>, tries: number, baseMs: number): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (baseMs > 0) await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw last;
}

export async function syncAsana(store: Store, connector: Connector<AsanaRecord>, opts: { retryBaseMs?: number; full?: boolean } = {}): Promise<SyncRun> {
  const startedAt = new Date().toISOString();
  const last = [...store.state.syncRuns].reverse().find((r) => r.connector === connector.id && r.ok);
  const since = opts.full ? null : last?.checkpoint ?? null;
  let cursor: string | null = null;
  let fetched = 0, created = 0, updated = 0, unchanged = 0;
  let maxModified = since;
  try {
    do {
      const page: { items: AsanaRecord[]; nextCursor: string | null } = await withRetry(() => connector.fetchList({ cursor, modifiedSince: since }), 4, opts.retryBaseMs ?? 250);
      for (const r of page.items) {
        fetched++;
        if (!maxModified || r.modifiedAt > maxModified) maxModified = r.modifiedAt;
        const existing = store.state.sourceRecords.find((s) => s.source === "asana" && s.objectType === "task" && s.externalId === r.gid);
        const canonical = r.crosswalkKey && DEALS.some((d) => d.id === r.crosswalkKey) ? r.crosswalkKey : null;
        if (!existing) {
          store.state.sourceRecords.push({ source: "asana", objectType: "task", externalId: r.gid, internalId: canonical, name: r.name, stage: r.stage, url: r.url, lastSeenAt: startedAt, asOf: r.modifiedAt, projectGid: r.projectGid });
          created++;
        } else if (existing.name !== r.name || existing.stage !== r.stage || existing.asOf !== r.modifiedAt || existing.internalId !== canonical) {
          Object.assign(existing, { name: r.name, stage: r.stage, asOf: r.modifiedAt, lastSeenAt: startedAt, internalId: canonical ?? existing.internalId });
          updated++;
        } else { existing.lastSeenAt = startedAt; unchanged++; }

        if (canonical) {
          if (!store.state.entityLinks.some((l) => l.source === "asana" && l.externalId === r.gid)) {
            store.state.entityLinks.push({ source: "asana", objectType: "task", externalId: r.gid, internalId: canonical, reviewStatus: "auto", confidence: 1, reason: "Explicit crosswalk key" });
          }
        } else if (!store.state.reviewQueue.some((q) => q.source === "asana" && q.externalId === r.gid)) {
          const candidates = DEALS.map((d) => ({ internalId: d.id, score: similarity(d.name, r.name) })).filter((c) => c.score >= 0.4).sort((a, b) => b.score - a.score);
          store.state.reviewQueue.push({ id: uid(), source: "asana", externalId: r.gid, candidates, name: r.name, createdAt: startedAt, status: "open" });
        }
      }
      cursor = page.nextCursor;
    } while (cursor);
    const run = { id: uid(), connector: connector.id, startedAt, finishedAt: new Date().toISOString(), ok: true, fetched, created, updated, unchanged, checkpoint: maxModified };
    store.state.syncRuns.push(run);
    audit(store, { actor: "system", action: "sync.run", target: connector.id, detail: `fetched=${fetched} created=${created} updated=${updated}`, ok: true });
    return run;
  } catch (e) {
    const category = (e as { category?: string }).category ?? "network";
    const run = { id: uid(), connector: connector.id, startedAt, finishedAt: new Date().toISOString(), ok: false, fetched, created, updated, unchanged, checkpoint: since, errorCategory: category };
    store.state.syncRuns.push(run);
    audit(store, { actor: "system", action: "sync.run", target: connector.id, detail: `error=${category}`, ok: false });
    return run;
  }
}
