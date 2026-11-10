import type { Permission } from "../authz";

// Read-only connector contract. No method may write to an external system in v1.
export type ConnectorStatus = "not_configured" | "fixture" | "ok" | "error";
export type Page<T> = { items: T[]; nextCursor: string | null };

export interface Connector<T> {
  readonly id: string;
  readonly kind: "asana" | "rent_manager" | "notion" | "google_drive" | "gmail" | "ghl" | "meow";
  readonly mode: "fixture" | "live";
  readonly supportedPermissions: Permission[];
  configured(): boolean;
  validateConnection(): Promise<{ ok: boolean; errorCategory?: "not_configured" | "auth" | "network" | "rate_limit" }>;
  // Cursor paging with an optional modifiedSince checkpoint, so repeat syncs are incremental.
  fetchList(opts: { cursor?: string | null; modifiedSince?: string | null }): Promise<Page<T>>;
  fetchById(id: string): Promise<T | null>;
}
