// Pure data: roles, permissions, and role-to-department binding. Used by authz.ts and the SQL seed generator.
import type { Department } from "./departments.ts";

export const PERMISSIONS = [
  "view_company_summary",
  "view_property_financials",
  "view_tenant_details",
  "view_deal_financials",
  "view_investor_pii",
  "view_executive",
  "manage_users",
  "manage_integrations",
  "manage_ai",
  "manage_tasks_local",
  "request_external_write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  "owner_admin",
  "ops_manager",
  "ops_staff",
  "acquisitions_manager",
  "acquisitions_staff",
  "ir_manager",
  "ir_staff",
  "external_pm",
  "external_contractor",
  "restricted_viewer",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner_admin: PERMISSIONS,
  ops_manager: ["view_company_summary", "view_property_financials", "view_tenant_details", "manage_tasks_local", "request_external_write"],
  ops_staff: ["view_company_summary", "view_property_financials", "manage_tasks_local"],
  acquisitions_manager: ["view_company_summary", "view_deal_financials", "manage_tasks_local", "request_external_write"],
  acquisitions_staff: ["view_company_summary", "manage_tasks_local"],
  ir_manager: ["view_company_summary", "view_investor_pii", "manage_tasks_local", "request_external_write"],
  ir_staff: ["view_company_summary", "view_investor_pii", "manage_tasks_local"],
  external_pm: ["view_property_financials"],
  external_contractor: ["view_company_summary"],
  restricted_viewer: ["view_company_summary"],
};

export const ROLE_HOME: Partial<Record<Role, Department>> = {
  ops_manager: "operations",
  ops_staff: "operations",
  acquisitions_manager: "acquisitions",
  acquisitions_staff: "acquisitions",
  ir_manager: "ir",
  ir_staff: "ir",
};

