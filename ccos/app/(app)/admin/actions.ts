"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStore, audit } from "@/lib/store";
import { getCurrentUser } from "@/lib/session";
import { createInvite, deactivateUser, revokeInvite } from "@/lib/auth";
import { HttpError, ROLES, assertCan, type Grant, type Role, type ScopeType } from "@/lib/authz";
import { syncAsana } from "@/lib/sync";
import { asanaFixture } from "@/lib/connectors/asana-fixture";
import { DEALS } from "@/lib/fixtures";

async function actor() {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "Not signed in");
  return u;
}

export async function inviteAction(form: FormData) {
  const u = await actor();
  const role = String(form.get("role")) as Role;
  const scopeType = String(form.get("scopeType")) as ScopeType;
  const scopeId = String(form.get("scopeId") ?? "").trim() || null;
  if (!ROLES.includes(role)) throw new HttpError(400, "Unknown role");
  const grant: Grant = { role, scopeType, scopeId: scopeType === "org" ? null : scopeId };
  let token: string;
  try {
    token = createInvite(getStore(), u, String(form.get("email") ?? ""), [grant]).token;
  } catch (e) {
    redirect(`/admin?error=${encodeURIComponent(e instanceof HttpError ? e.message : "Could not create invite")}`);
  }
  redirect(`/admin?invite=${encodeURIComponent(token)}&for=${encodeURIComponent(String(form.get("email") ?? ""))}`);
}

export async function revokeInviteAction(form: FormData) {
  revokeInvite(getStore(), await actor(), String(form.get("id")));
  revalidatePath("/admin");
}

export async function deactivateAction(form: FormData) {
  try { deactivateUser(getStore(), await actor(), String(form.get("id"))); } catch (e) {
    redirect(`/admin?error=${encodeURIComponent(e instanceof HttpError ? e.message : "Failed")}`);
  }
  revalidatePath("/admin");
}

export async function syncAction() {
  const u = await actor();
  assertCan(u, "manage_integrations");
  await syncAsana(getStore(), asanaFixture(), { retryBaseMs: 0 });
  revalidatePath("/admin");
}

export async function aiConfigAction(form: FormData) {
  const u = await actor();
  assertCan(u, "manage_ai");
  const store = getStore();
  const provider = String(form.get("provider"));
  if (!store.state.aiConfig.allowedProviders.includes(provider)) throw new HttpError(400, "Provider not allowed");
  store.state.aiConfig.enabled = form.get("enabled") === "on";
  store.state.aiConfig.provider = provider;
  store.state.aiConfig.hourlyLimitPerUser = Math.max(1, Math.min(200, Number(form.get("limit")) || 20));
  audit(store, { actor: u.id, action: "ai.config", detail: `enabled=${store.state.aiConfig.enabled} provider=${provider}`, ok: true });
  revalidatePath("/admin");
}

export async function kpiConfigAction(form: FormData) {
  const u = await actor();
  assertCan(u, "manage_integrations");
  const pass = Number(form.get("pass")), red = Number(form.get("red"));
  if (!(red > 0 && pass <= 100 && red < pass)) redirect("/admin?error=" + encodeURIComponent("Red threshold must be below the passing grade"));
  const store = getStore();
  store.state.kpiConfig = { collectionsPass: pass, collectionsRed: red };
  audit(store, { actor: u.id, action: "kpi.config", detail: `pass=${pass} red=${red}`, ok: true });
  revalidatePath("/admin");
}

export async function resolveReviewAction(form: FormData) {
  const u = await actor();
  assertCan(u, "manage_integrations");
  const store = getStore();
  const item = store.state.reviewQueue.find((r) => r.id === String(form.get("id")));
  const dealId = String(form.get("dealId"));
  if (!item || item.status !== "open") throw new HttpError(404, "Review item not found");
  if (dealId === "none") { item.status = "resolved"; } else {
    if (!DEALS.some((d) => d.id === dealId)) throw new HttpError(400, "Unknown deal");
    store.state.entityLinks.push({ source: item.source, objectType: "task", externalId: item.externalId, internalId: dealId, reviewStatus: "confirmed", confidence: 1, reason: "Confirmed by reviewer" });
    const rec = store.state.sourceRecords.find((r) => r.externalId === item.externalId);
    if (rec) rec.internalId = dealId;
    item.status = "resolved";
  }
  audit(store, { actor: u.id, action: "review.resolve", target: item.externalId, detail: dealId, ok: true });
  revalidatePath("/admin");
}
