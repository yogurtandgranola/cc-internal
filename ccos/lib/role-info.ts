// Plain-language names, summaries and allowed scopes for each role. Used by the Admin screen and its checks.
import type { Role } from "./roles";
import type { ScopeType } from "./authz";

export const ROLE_INFO: Record<Role, { label: string; summary: string; scopes: readonly ScopeType[] }> = {
  owner_admin: { label: "Owner", summary: "Everything, including people and settings.", scopes: ["org"] },
  ops_manager: { label: "Operations manager", summary: "All operations data in their scope, including tenant detail.", scopes: ["department", "property"] },
  ops_staff: { label: "Operations staff", summary: "Property numbers and tasks. No tenant detail.", scopes: ["property", "department"] },
  acquisitions_manager: { label: "Acquisitions manager", summary: "Deals with prices and underwriting numbers.", scopes: ["department", "deal"] },
  acquisitions_staff: { label: "Acquisitions staff", summary: "Deals without prices.", scopes: ["department", "deal"] },
  acquisitions_coordinator: { label: "Acquisitions coordinator", summary: "Deal pipeline, due dates and diligence tasks. No prices.", scopes: ["department", "deal"] },
  ir_manager: { label: "Investor relations manager", summary: "Investor list, contact details and commitments.", scopes: ["department", "investor"] },
  ir_staff: { label: "Investor relations staff", summary: "Investor list, contact details and commitments.", scopes: ["department", "investor"] },
  ir_coordinator: { label: "Investor relations coordinator", summary: "Which investor tasks are due. No contact details, no amounts.", scopes: ["department"] },
  external_pm: { label: "Outside property manager", summary: "Their own property only.", scopes: ["property"] },
  external_contractor: { label: "Contractor or consultant", summary: "Summary information, only where you grant it.", scopes: ["property", "department", "deal"] },
  restricted_viewer: { label: "Viewer", summary: "Summary information, only where you grant it.", scopes: ["property", "department", "deal"] },
};
export const SCOPE_LABEL: Record<ScopeType, string> = { org: "Whole company", department: "Department", property: "Property", deal: "Deal", legal_entity: "Legal entity", investor: "Investor" };
