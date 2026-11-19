"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/authz";
import { defaultDb } from "@/lib/live-auth";
import { rentManagerConfigured, syncOccupancy } from "@/lib/connectors/rentmanager-live";

export type RefreshState = { ok?: string; error?: string } | undefined;

// Same refresh the daily job runs. Owner and operations manager only. Read-only against Rent Manager.
export async function refreshRentManagerAction(): Promise<RefreshState> {
  const user = await getCurrentUser();
  if (!user || !user.live || !can(user, "upload_data")) return { error: "You do not have permission to refresh." };
  if (!rentManagerConfigured()) return { error: "Rent Manager is not connected. The login still needs to be added in Vercel." };
  try {
    const r = await syncOccupancy(defaultDb());
    revalidatePath("/operations");
    revalidatePath("/");
    if (r.saved === 0) return { error: `Signed in, but no properties matched. Names not matched: ${r.unmatched.join(", ") || "none"}.` };
    return { ok: `Updated ${r.saved} properties from Rent Manager.${r.unmatched.length ? ` Not matched: ${r.unmatched.join(", ")}.` : ""}` };
  } catch (e) {
    console.error("rent manager refresh failed", e instanceof Error ? e.message : e);
    const m = e instanceof Error ? e.message : "";
    return { error: /sign-in failed/i.test(m) ? "Rent Manager did not accept the login. Check the username and password in Vercel." : m.startsWith("Rent Manager") ? m : "Could not reach Rent Manager. Nothing was changed." };
  }
}
