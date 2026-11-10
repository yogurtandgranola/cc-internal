import Link from "next/link";
import { forbidden } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import * as dal from "@/lib/dal";
import { Badge, Crumbs, PageHeader, sevTone } from "@/components/ui";
import { dateText, kpiText, money } from "@/lib/format";

export default async function ExecutivePage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = sp.scope === "deals" ? "deals" : "portfolio";
  const b = dal.executiveBrief(user, getStore(), scope);
  if (!b) forbidden();
  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Executive" }]} />
      <PageHeader title="Executive briefing" sub="What needs attention. Owned assets and deals in diligence are kept apart so they are never combined." actions={
        <span className="flex gap-2">
          <Link className="btn" href="/executive?scope=portfolio" aria-current={scope === "portfolio"}>Owned assets</Link>
          <Link className="btn" href="/executive?scope=deals" aria-current={scope === "deals"}>Deals in diligence</Link>
        </span>
      } />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2" aria-labelledby="ex">
          <h2 id="ex" className="font-semibold">Exceptions by severity</h2>
          <ul className="mt-2 divide-y">
            {b.exceptions.filter((e) => (scope === "deals" ? !!e.dealId : !e.dealId)).map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-2 py-2">
                <div><Link href={`/exceptions/${e.id}`}>{e.title}</Link><div className="muted text-xs">{e.owner} · target {dateText(e.targetDate)} · {e.valueAtRisk ? `at risk ${money(e.valueAtRisk)}` : "no value at risk stated"}</div></div>
                <Badge tone={sevTone(e.severity)}>{e.severity}</Badge>
              </li>
            ))}
          </ul>
          <p className="muted mt-2 text-xs">Total stated value at risk (this view and others): {money(b.valueAtRisk)}. Amounts are not added across owned assets and deals.</p>
        </section>
        <section className="card p-4" aria-labelledby="dl">
          <h2 id="dl" className="font-semibold">Deadlines (next 90 days)</h2>
          <ul className="mt-2 space-y-1 text-sm">{b.deadlines.filter((d) => (scope === "deals" ? d.kind === "deal" : d.kind === "renewal")).map((d) => (<li key={d.label}>{dateText(d.date)} · {d.label}</li>))}</ul>
        </section>
        {scope === "portfolio" ? (
          <section className="card p-4 lg:col-span-2" aria-labelledby="pf">
            <h2 id="pf" className="font-semibold">Owned assets</h2>
            <div className="overflow-x-auto"><table className="t mt-2">
              <thead><tr><th>Property</th><th>Collections</th><th>Occupancy</th><th>TTM NOI</th></tr></thead>
              <tbody>{b.properties.map((p) => (<tr key={p.id}><td><Link href={`/operations/${p.id}`}>{p.name}</Link></td><td>{p.financials ? kpiText(p.financials.collections) : "Restricted"}</td><td>{p.financials ? kpiText(p.financials.occupancy) : "Restricted"}</td><td>{p.financials ? kpiText(p.financials.ttmNoi) : "Restricted"}</td></tr>))}</tbody>
            </table></div>
          </section>
        ) : (
          <section className="card p-4 lg:col-span-2" aria-labelledby="bd">
            <h2 id="bd" className="font-semibold">Blocked decisions</h2>
            <ul className="mt-2 space-y-2 text-sm">{b.blockedDecisions.map((d) => (<li key={d.id}><Link href={`/deals/${d.id}`}>{d.name}</Link><div className="muted text-xs">{d.blockers.join("; ")}</div></li>))}</ul>
            <p className="mt-3 text-sm">Pipeline (asking price basis): {kpiText(b.pipeline.kpi)} across {b.pipeline.canonicalDeals} canonical deals.</p>
          </section>
        )}
        <section className="card p-4" aria-labelledby="irx">
          <h2 id="irx" className="font-semibold">Capital (internal)</h2>
          {b.ir ? <ul className="mt-2 text-sm"><li>Soft {money(b.ir.soft)}</li><li>Signed {money(b.ir.signed)}</li><li>Collected {money(b.ir.collected)}</li></ul> : <p className="muted text-sm">Not available in your scope.</p>}
          <p className="muted mt-2 text-xs">Liquidity watch needs authorized bank data. Not connected.</p>
        </section>
      </div>
    </>
  );
}
