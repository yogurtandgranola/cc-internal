import type { Department } from "./authz";

export type Property = {
  id: string; name: string; city: string; state: string; department: "operations"; entityId: string;
  status: "owned" | "sold"; licensedSites: number; operationalRentableSites: number;
  mix: { toh: number; poh: number; rto: number } | null;
  plan: { version: string; approvedAt: string; targetOccupancy: number; targetTtmNoi: number } | null;
  links: { notion?: string; drive?: string; asana?: string; rentManager?: string };
};
export type PropertyMonth = {
  propertyId: string; month: string; occupied: number | null; rentable: number | null; chargesDue: number | null;
  paymentsAllocated: number | null; priorRecoveries: number | null; income: number | null; expense: number | null;
  moveIns: number | null; moveOuts: number | null; asOf: string; source: "rent_manager"; sourceUrl: string;
};
export type Milestone = { id: string; propertyId: string; stage: string; baseline: string; forecast: string | null; actual: string | null; owner: string; budget: number | null; spent: number | null; risk?: string };
export type Renewal = { id: string; propertyId: string; type: string; dueDate: string | null; owner: string; verifiedBy: string | null; sopUrl?: string; asanaUrl?: string };
export type Exception = {
  id: string; severity: "high" | "medium" | "low"; title: string; department: Department; propertyId?: string; dealId?: string;
  valueAtRisk: number | null; owner: string; nextAction: string; targetDate: string; blocker: string | null; evidenceUrl: string; sourceTaskId: string | null; rootCause: string;
};
export type Task = { id: string; name: string; assignee: string; due: string | null; status: "open" | "done"; projectGid: string; department: Department; propertyId?: string; dealId?: string; url: string };
export type Deal = {
  id: string; name: string; kind: "asset" | "portfolio"; stage: string; state: string; city: string; lots: number | null; pohPct: number | null;
  occupancy: number | null; askingPrice: number | null; loiPrice: number | null; noi: number | null; askingCap: number | null;
  utility: "municipal" | "wwtp" | "lagoon" | "private_septic" | "unknown"; source: string; uwVersion: string | null; owner: string;
  lastContact: string | null; nextAction: string | null; ddDeadline: string | null; lender: string | null; blockers: string[];
  decision: "active" | "pass" | "discard"; decisionReason: string | null; department: "acquisitions"; confidence: "high" | "medium" | "low";
  links: { asana?: string; drive?: string; underwriting?: string };
};
export type AsanaRecord = { gid: string; projectGid: string; projectName: string; name: string; stage: string; crosswalkKey: string | null; url: string; modifiedAt: string };
export type Investor = { id: string; name: string; contactEmail: string; relationship: string; lastTouch: string | null; nextTouch: string | null; department: "ir" };
export type CommitmentRow = { investorId: string; kind: "soft" | "signed" | "collected"; amount: number; dealId: string; source: string; asOf: string };
export type Doc = { id: string; title: string; text: string; department: Department; propertyId?: string; url: string };
