"use server";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/store";
import { acceptInvite, assertMockAuthAllowed, login } from "@/lib/auth";
import { HttpError } from "@/lib/authz";
import { setSessionCookie } from "@/lib/session";

export async function acceptInviteAction(form: FormData) {
  assertMockAuthAllowed();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  let email: string;
  try {
    email = acceptInvite(getStore(), token, String(form.get("name") ?? ""), password).email;
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : "Could not accept the invitation";
    redirect(`/invite?token=${encodeURIComponent(token)}&error=${encodeURIComponent(msg)}`);
  }
  const res = login(getStore(), email, password);
  if (res) await setSessionCookie(res.token);
  redirect("/");
}
