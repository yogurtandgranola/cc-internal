import { describe, expect, it } from "vitest";
import { createStore } from "@/lib/store";
import { syncAsana, similarity } from "@/lib/sync";
import { asanaFixture } from "@/lib/connectors/asana-fixture";

describe("asana sync", () => {
  it("links two source records of one deal to a single canonical deal", async () => {
    const store = createStore();
    await syncAsana(store, asanaFixture(), { retryBaseMs: 0 });
    const oak = store.state.sourceRecords.filter((r) => r.internalId === "d-oak");
    expect(oak.map((r) => r.externalId).sort()).toEqual(["a1", "a2"]);
    expect(new Set(store.state.entityLinks.filter((l) => l.internalId === "d-oak").map((l) => l.internalId)).size).toBe(1);
  });

  it("never auto-links by name similarity, sends it to human review", async () => {
    const store = createStore();
    await syncAsana(store, asanaFixture(), { retryBaseMs: 0 });
    const a5 = store.state.sourceRecords.find((r) => r.externalId === "a5")!;
    expect(a5.internalId).toBeNull();
    const q = store.state.reviewQueue.find((r) => r.externalId === "a5")!;
    expect(q.status).toBe("open");
    expect(q.candidates[0]?.internalId).toBe("d-oak");
    expect(similarity("Demo Oak Ridge MHC", "Demo Oak Ridge Estates")).toBeGreaterThan(0.4);
  });

  it("is idempotent across repeated refreshes", async () => {
    const store = createStore();
    await syncAsana(store, asanaFixture(), { retryBaseMs: 0 });
    const snapshot = JSON.stringify({ r: store.state.sourceRecords.map((x) => [x.externalId, x.internalId, x.name, x.stage]), l: store.state.entityLinks, q: store.state.reviewQueue.map((x) => x.externalId) });
    await syncAsana(store, asanaFixture(), { retryBaseMs: 0 });
    await syncAsana(store, asanaFixture(), { retryBaseMs: 0, full: true });
    const after = JSON.stringify({ r: store.state.sourceRecords.map((x) => [x.externalId, x.internalId, x.name, x.stage]), l: store.state.entityLinks, q: store.state.reviewQueue.map((x) => x.externalId) });
    expect(after).toBe(snapshot);
    expect(store.state.sourceRecords).toHaveLength(5);
  });

  it("second incremental run fetches nothing new", async () => {
    const store = createStore();
    await syncAsana(store, asanaFixture(), { retryBaseMs: 0 });
    const run = await syncAsana(store, asanaFixture(), { retryBaseMs: 0 });
    expect(run.fetched).toBe(0);
  });

  it("retries transient errors and records a failed run when retries run out", async () => {
    const store = createStore();
    const ok = await syncAsana(store, asanaFixture({ failFirstNCalls: 2 }), { retryBaseMs: 0 });
    expect(ok.ok).toBe(true);
    const store2 = createStore();
    const bad = await syncAsana(store2, asanaFixture({ failFirstNCalls: 10 }), { retryBaseMs: 0 });
    expect(bad.ok).toBe(false);
    expect(bad.errorCategory).toBe("rate_limit");
  });

  it("pages through all records", async () => {
    const store = createStore();
    const c = asanaFixture({ pageSize: 2 });
    const run = await syncAsana(store, c, { retryBaseMs: 0 });
    expect(run.fetched).toBe(5);
    expect(c.calls).toBe(3);
  });
});
