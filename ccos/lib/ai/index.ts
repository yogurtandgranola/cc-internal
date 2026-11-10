import { HttpError, type SessionUser } from "../authz";
import { audit, uid, type Store } from "../store";
import { PROVIDERS, costEstimate } from "./provider";
import { SYSTEM_PROMPT, buildContext } from "./retrieve";

export type AiAnswer = { status: "answered" | "refused" | "disabled" | "rate_limited" | "error"; text: string; provider: string; citations: { id: string; label: string; source: string; url?: string; asOf?: string }[]; demo: boolean };

const WRITE_INTENT = /\b(send|email|pay|wire|delete|update|change|modify|cancel|submit|file|notify|text|call)\b.*\b(tenant|investor|invoice|rent|lease|asana|notion|rent manager|vendor|bank|account|task)\b/i;

export async function ask(store: Store, user: SessionUser, question: string, providerOverride?: string): Promise<AiAnswer> {
  const cfg = store.state.aiConfig;
  const demo = process.env.CCOS_MODE !== "live";
  const providerId = providerOverride && cfg.allowedProviders.includes(providerOverride) ? providerOverride : cfg.provider;
  const log = (outcome: AiAnswer["status"], extra: Partial<{ sourcesUsed: number; p: number; c: number; cost: number }> = {}) => {
    store.state.aiLog.unshift({ id: uid(), at: new Date().toISOString(), userId: user.id, provider: providerId, question: question.slice(0, 300), sourcesUsed: extra.sourcesUsed ?? 0, promptTokensEst: extra.p ?? 0, completionTokensEst: extra.c ?? 0, costUsdEst: extra.cost ?? 0, outcome });
    audit(store, { actor: user.id, action: "ai.request", detail: `${providerId}:${outcome}`, ok: outcome === "answered" || outcome === "refused" });
  };
  const base = { provider: providerId, citations: [], demo };

  if (!cfg.enabled) { log("disabled"); return { ...base, status: "disabled", text: "The AI assistant is turned off by an administrator. All dashboards still work." }; }
  const hourAgo = Date.now() - 3_600_000;
  if (store.state.aiLog.filter((r) => r.userId === user.id && Date.parse(r.at) > hourAgo).length >= cfg.hourlyLimitPerUser) { log("rate_limited"); return { ...base, status: "rate_limited", text: "Hourly question limit reached. Try again later." }; }
  const q = question.trim().slice(0, 1000);
  if (q.length < 3) throw new HttpError(400, "Ask a question");
  if (WRITE_INTENT.test(q)) { log("refused"); return { ...base, status: "refused", text: "The assistant is read-only in this version. It cannot send, pay, edit, or notify. Use the source system or an approved workflow." }; }

  const provider = PROVIDERS[providerId];
  if (!provider || !provider.configured()) { log("error"); return { ...base, status: "error", text: "The selected AI provider is not available. Dashboards are unaffected." }; }
  try {
    const context = buildContext(user, store);
    const out = await provider.generate({ system: SYSTEM_PROMPT, question: q, context, demo });
    const cited = context.filter((c) => out.citedIds.includes(c.id));
    log(out.citedIds.length ? "answered" : "refused", { sourcesUsed: cited.length, p: out.promptTokensEst, c: out.completionTokensEst, cost: costEstimate(provider.kind, out.promptTokensEst + out.completionTokensEst) });
    return { ...base, status: out.citedIds.length ? "answered" : "refused", text: out.text, citations: cited.map((c) => ({ id: c.id, label: c.label, source: c.source, url: c.url, asOf: c.asOf })) };
  } catch {
    log("error");
    return { ...base, status: "error", text: "The AI provider failed. Dashboards are unaffected." };
  }
}
