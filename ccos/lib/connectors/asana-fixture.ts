import { ASANA_RECORDS } from "../fixtures";
import type { AsanaRecord } from "../types";
import type { Connector, Page } from "./types";

// Fixture adapter that behaves like the Asana API: paginated, incremental, and able to fail.
// It does NOT talk to Asana. Replace with a live adapter that reads ASANA_ACCESS_TOKEN on the server.
export function asanaFixture(opts: { pageSize?: number; failFirstNCalls?: number; records?: AsanaRecord[] } = {}): Connector<AsanaRecord> & { calls: number } {
  const pageSize = opts.pageSize ?? 2;
  const records = opts.records ?? ASANA_RECORDS;
  let failures = opts.failFirstNCalls ?? 0;
  const c = {
    calls: 0,
    id: "asana-fixture", kind: "asana" as const, mode: "fixture" as const, supportedPermissions: ["view_company_summary" as const],
    configured: () => false,
    async validateConnection() { return { ok: true }; },
    async fetchList({ cursor, modifiedSince }: { cursor?: string | null; modifiedSince?: string | null }): Promise<Page<AsanaRecord>> {
      c.calls++;
      if (failures > 0) { failures--; const e = new Error("rate_limit"); (e as Error & { category: string }).category = "rate_limit"; throw e; }
      const filtered = records.filter((r) => !modifiedSince || r.modifiedAt > modifiedSince).sort((a, b) => a.gid.localeCompare(b.gid));
      const start = cursor ? Number(cursor) : 0;
      const items = filtered.slice(start, start + pageSize);
      const next = start + pageSize < filtered.length ? String(start + pageSize) : null;
      return { items, nextCursor: next };
    },
    async fetchById(id: string) { return records.find((r) => r.gid === id) ?? null; },
  };
  return c;
}
