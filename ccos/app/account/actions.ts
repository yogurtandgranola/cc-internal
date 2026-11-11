"use server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { HttpError } from "@/lib/authz";
import { defaultDb } from "@/lib/live-auth";
import { changeOwnPassword, supabaseAuthAdmin } from "@/lib/live-admin";
import type { FormState } from "@/lib/admin-form";

export async function changePasswordAction(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || !user.live) redirect("/login");
  const current = String(f.get("current") ?? "");
  const next = String(f.get("next") ?? "");
  if (next !== String(f.get("confirm") ?? "")) return { error: "The two new passwords do not match." };
  try {
    await changeOwnPassword({ db: defaultDb(), auth: supabaseAuthAdmin() }, user, current, next);
  } catch (e) {
    if (e instanceof HttpError) return { error: e.message };
    console.error("password change failed", e instanceof Error ? e.message : e);
    return { error: "Something went wrong. Your password was not changed. Try again in a minute." };
  }
  redirect("/");
}
