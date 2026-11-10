import type { Connector } from "./types";

// Rent Manager is read-only and NOT connected in v1. The existing rent-manager-mcp service is a candidate reference.
// This stub states the truth: not configured. Metrics in demo mode come from lib/fixtures.ts and are labelled synthetic.
export function rentManagerStub(): Connector<never> {
  return {
    id: "rentmanager", kind: "rent_manager", mode: "live", supportedPermissions: ["view_property_financials"],
    configured: () => Boolean(process.env.RENTMANAGER_BASE_URL && process.env.RENTMANAGER_API_KEY),
    async validateConnection() { return { ok: false, errorCategory: "not_configured" }; },
    async fetchList() { throw new Error("Rent Manager connector is not implemented in v1"); },
    async fetchById() { return null; },
  };
}
