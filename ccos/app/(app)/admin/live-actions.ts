"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { HttpError } from "@/lib/authz";
import { defaultDb } from "@/lib/live-auth";
import { addGrants, addPerson, addProperty, resetPassword, revokeGrant, setActive, supabaseAuthAdmin, type AdminDeps } from "@/lib/live-admin";
import type { FormState } from "@/lib/admin-form";

const deps = (): AdminDeps => ({ db: defaultDb(), auth: supabaseAuthAdmin() });
async function actor() {
  const u = await getCurrentUser();
  if (!u || !u.live) throw new HttpError(401, "Not signed in");
  return u;
}
const fail = (e: unknown): FormState => {
  if (e instanceof HttpError) return { error: e.message };
  console.error("admin action failed", e instanceof Error ? e.message : e);
  return { error: "Something went wrong. Nothing was changed. Try again in a minute." };
};
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function addPersonAction(_prev: FormState, f: FormData): Promise<FormState> {
  try {
    const r = await addPerson(deps(), await actor(), { email: str(f, "email"), name: str(f, "name"), role: str(f, "role"), scopeType: str(f, "scopeType"), scopeIds: f.getAll("scopeId").map(String) });
    revalidatePath("/admin");
    return { ok: `Added ${str(f, "email").trim().toLowerCase()}.`, email: str(f, "email").trim().toLowerCase(), tempPassword: r.tempPassword ?? undefined };
  } catch (e) { return fail(e); }
}
export async function addGrantsAction(_prev: FormState, f: FormData): Promise<FormState> {
  try {
    const n = await addGrants(deps(), await actor(), str(f, "userId"), { role: str(f, "role"), scopeType: str(f, "scopeType"), scopeIds: f.getAll("scopeId").map(String) });
    revalidatePath("/admin");
    return { ok: n === 1 ? "Access added." : `${n} accesses added.` };
  } catch (e) { return fail(e); }
}
export async function resetPasswordAction(_prev: FormState, f: FormData): Promise<FormState> {
  try {
    const r = await resetPassword(deps(), await actor(), str(f, "userId"));
    revalidatePath("/admin");
    return { ok: `New temporary password for ${r.email}.`, email: r.email, tempPassword: r.tempPassword };
  } catch (e) { return fail(e); }
}
export async function addPropertyAction(_prev: FormState, f: FormData): Promise<FormState> {
  try {
    await addProperty(deps(), await actor(), { name: str(f, "name"), city: str(f, "city"), state: str(f, "state") });
    revalidatePath("/admin");
    return { ok: `Added ${str(f, "name").trim()}.` };
  } catch (e) { return fail(e); }
}
export async function revokeGrantAction(f: FormData) {
  let msg = "";
  try { await revokeGrant(deps(), await actor(), str(f, "grantId")); } catch (e) { msg = fail(e)?.error ?? ""; }
  if (msg) redirect(`/admin?error=${encodeURIComponent(msg)}`);
  revalidatePath("/admin");
}
export async function setActiveAction(f: FormData) {
  let msg = "";
  try { await setActive(deps(), await actor(), str(f, "userId"), str(f, "active") === "true"); } catch (e) { msg = fail(e)?.error ?? ""; }
  if (msg) redirect(`/admin?error=${encodeURIComponent(msg)}`);
  revalidatePath("/admin");
}
