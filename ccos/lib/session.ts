import { cookies } from "next/headers";
import { redirect, forbidden } from "next/navigation";
import { getStore } from "./store";
import { mockAuthAllowed, userFromToken } from "./auth";
import { defaultDeps, isLiveToken, liveAuthConfigured, liveUserFromToken } from "./live-auth";
import { can, type Department, type Permission, type Resource, type SessionUser } from "./authz";
import { visibleDepartments } from "./dal";

export const COOKIE = "ccos_session";

// One place that turns a session cookie into a user. Real accounts carry an "L1." token and are checked against the database
// on every request. Demo accounts are checked against the in-memory store and only while the hosted demo is allowed.
export async function resolveUser(token: string | undefined | null): Promise<SessionUser | null> {
  if (isLiveToken(token)) return liveAuthConfigured() ? liveUserFromToken(token, defaultDeps()) : null;
  if (!mockAuthAllowed()) return null;
  return userFromToken(getStore(), token);
}
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value; // reading cookies also makes every page dynamic
  return resolveUser(token);
}
export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}
export async function requirePermission(perm: Permission, resource?: Resource): Promise<SessionUser> {
  const u = await requireUser();
  if (!can(u, perm, resource)) forbidden();
  return u;
}
// Page-level gate for a department area. Scoped users (one property, one deal) pass when they can see at least one record.
export async function requireDepartment(dept: Department): Promise<SessionUser> {
  const u = await requireUser();
  if (!visibleDepartments(u).includes(dept)) forbidden();
  return u;
}
export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 3600 });
}
export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}
