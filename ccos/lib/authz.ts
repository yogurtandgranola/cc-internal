// Authorization model: roles carry permissions, grants attach roles to scopes.
// Every data path (pages, route handlers, server actions, AI retrieval) goes through can().

import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, ROLE_HOME, type Permission, type Role } from "./roles";
import { DEPARTMENTS, type Department } from "./departments";
export { PERMISSIONS, ROLES, ROLE_PERMISSIONS, DEPARTMENTS };
export type { Permission, Role, Department };


export type ScopeType = "org" | "department" | "property" | "deal" | "legal_entity" | "investor";
export type Grant = { role: Role; scopeType: ScopeType; scopeId: string | null };

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  sessionVersion: number;
  grants: Grant[];
  /** True for a real account that signed in through Supabase. Demo accounts leave this unset. */
  live?: boolean;
  /** True while the person still uses a temporary password and has to choose their own. */
  mustChangePassword?: boolean;
};

// A resource describes what is being accessed. Scope coverage is derived from these fields.
export type Resource = {
  type: "org" | "property" | "deal" | "investor" | "task" | "document";
  id?: string;
  department?: Department;
  propertyId?: string;
  dealId?: string;
  entityId?: string;
};

function covers(g: Grant, r: Resource): boolean {
  switch (g.scopeType) {
    case "org":
      return true;
    case "department":
      return !!r.department && g.scopeId === r.department;
    case "property":
      return (r.type === "property" && r.id === g.scopeId) || r.propertyId === g.scopeId;
    case "deal":
      return (r.type === "deal" && r.id === g.scopeId) || r.dealId === g.scopeId;
    case "legal_entity":
      return r.entityId === g.scopeId;
    case "investor":
      return r.type === "investor" && r.id === g.scopeId;
  }
}

export function can(user: SessionUser | null | undefined, perm: Permission, resource: Resource = { type: "org" }): boolean {
  if (!user || !user.active) return false;
  // A grant's role may also be limited to its home department, so an ops role never reaches IR records
  // even if someone mistakenly gives it org scope. Owner and external roles are not department-bound.
  return user.grants.some((g) => {
    if (!ROLE_PERMISSIONS[g.role].includes(perm)) return false;
    if (!roleAllowedForDepartment(g.role, resource)) return false;
    return covers(g, resource);
  });
}

function roleAllowedForDepartment(role: Role, r: Resource): boolean {
  const home = ROLE_HOME[role];
  if (!home) return true;
  if (r.type === "org") return true;
  // Resource without a department tag is only reachable by non department-bound roles.
  return r.department === home;
}

export function canAny(user: SessionUser | null | undefined, perms: Permission[], resource?: Resource): boolean {
  return perms.some((p) => can(user, p, resource));
}

export class HttpError extends Error {
  constructor(public status: 401 | 403 | 404 | 429 | 400, message: string) {
    super(message);
  }
}

export function assertCan(user: SessionUser | null | undefined, perm: Permission, resource?: Resource): asserts user is SessionUser {
  if (!user) throw new HttpError(401, "Not signed in");
  if (!can(user, perm, resource)) throw new HttpError(403, "Forbidden");
}
