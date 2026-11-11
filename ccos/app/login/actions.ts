"use server";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/store";
import { login, mockAuthAllowed } from "@/lib/auth";
import { defaultDeps, liveAuthConfigured, liveLogin } from "@/lib/live-auth";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";

type State = { error?: string; email?: string } | undefined;
const BAD = "Email or password is incorrect, or the account is inactive.";

export async function loginAction(_prev: State, form: FormData): Promise<State> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  let token: string | null = null;

  if (email.trim().toLowerCase().endsWith("@demo.example")) {
    // Fictional demo accounts. Only while the hosted demo or local mode is allowed.
    if (!mockAuthAllowed()) return { error: "Demo accounts are switched off here.", email };
    token = login(getStore(), email, password)?.token ?? null;
    if (!token) return { error: BAD, email };
  } else {
    if (!liveAuthConfigured()) return { error: "Real sign-in is not set up yet.", email };
    const res = await liveLogin(email, password, defaultDeps());
    if (!res.ok) {
      const msg = res.reason === "throttled" ? "Too many tries. Wait 15 minutes and try again."
        : res.reason === "no_access" ? "Your login works, but you have no access yet. Ask the owner to give you a role."
        : res.reason === "switched_off" ? "This account has been switched off. Ask the owner to switch it back on."
        : res.reason === "unavailable" ? "Sign-in is not available right now. Try again in a minute."
        : BAD;
      return { error: msg, email };
    }
    token = res.token;
  }
  await setSessionCookie(token);
  redirect("/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
