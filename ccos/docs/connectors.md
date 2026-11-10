# Connector inventory and contract

All connectors are read-only in v1. Code: `lib/connectors/types.ts`.

```ts
interface Connector<T> {
  id; kind; mode: "fixture" | "live"; supportedPermissions;
  configured(): boolean;
  validateConnection(): Promise<{ ok; errorCategory? }>;   // non-secret categories only
  fetchList({ cursor, modifiedSince }): Promise<{ items; nextCursor }>;
  fetchById(id): Promise<T | null>;
}
```

| Connector | Mode | Status | Mapping |
|---|---|---|---|
| asana-fixture | fixture | Working, tested | Task to `source_records`. Crosswalk key to canonical deal. Similar names to review queue |
| rentmanager | live | Stub, `not_configured` | Planned: property, period metrics, rent roll aggregates. Lease expiry fields are unreliable until reconciled to signed leases |
| notion | live | Not started | Links to SOPs and plans before any content copy |
| google_drive | live | Not started | Permission-checked deep links and metadata only |
| gmail, ghl, meow | live | Not started | Separate approved service credentials and granular scopes |

## Sync behavior (`lib/sync.ts`)
- Pagination by cursor, incremental by `modifiedSince` checkpoint taken from the last successful run.
- Retries with exponential backoff (4 tries). Failed runs are recorded with a non-secret error category and do not move the checkpoint.
- Idempotent upsert keyed on `(source, object type, external id)`. Repeating a sync changes nothing.
- A record with an explicit crosswalk key links automatically. Everything else is queued for a person.
- Raw task counts and canonical deal counts are both shown so duplicates stay visible.

## Going live (Asana example)
Write a live adapter that reads `ASANA_ACCESS_TOKEN` on the server, maps projects `1210103657050285` (Deal Flow CRM), `1212008883960421` (Ops), and `1212599842540169` (Investor Team), respects rate limits (HTTP 429 with Retry-After), and keeps the same contract tests. Inventory overlapping acquisition boards first and set the crosswalk key so one deal is never counted twice.

## Future writes
Any write needs a named workflow, an approval step, an audit entry, and the `request_external_write` permission. None exists in v1.
