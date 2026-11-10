import { requireUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import { Badge, Crumbs, PageHeader } from "@/components/ui";
import { AiChat } from "./chat";

export default async function AiPage() {
  const user = await requireUser();
  const cfg = getStore().state.aiConfig;
  const mine = getStore().state.aiLog.filter((r) => r.userId === user.id).slice(0, 5);
  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "AI analyst" }]} />
      <PageHeader title="AI analyst" sub="Read-only. Answers come only from records you are allowed to see, with sources and dates." actions={<Badge tone={cfg.enabled ? "good" : "warn"}>{cfg.enabled ? `On · provider ${cfg.provider}` : "Turned off by admin"}</Badge>} />
      {process.env.CCOS_MODE !== "live" ? <p className="mb-3 text-sm" style={{ color: "var(--warn)" }}>Demo: the deterministic mock provider answers from synthetic data. No external AI service is called.</p> : null}
      <AiChat enabled={cfg.enabled} providers={cfg.allowedProviders} current={cfg.provider} />
      <section className="mt-6" aria-labelledby="log"><h2 id="log" className="mb-2 text-sm font-semibold">Your recent questions</h2>
        {mine.length === 0 ? <p className="muted text-sm">None yet.</p> : <ul className="muted space-y-1 text-xs">{mine.map((r) => (<li key={r.id}>{r.at.slice(0, 16).replace("T", " ")} · {r.provider} · {r.outcome} · {r.question}</li>))}</ul>}
      </section>
    </>
  );
}
