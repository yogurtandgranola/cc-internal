"use server";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/store";
import { login, assertMockAuthAllowed } from "@/lib/auth";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";

export async function loginAction(_prev: { error?: string } | undefined, form: FormData) {
  assertMockAuthAllowed();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const res = login(getStore(), email, password);
  if (!res) return { error: "Email or password is incorrect, or the account is inactive." };
  await setSessionCookie(res.token);
  redirect("/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
