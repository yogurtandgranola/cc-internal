import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import * as dal from "@/lib/dal";
import { can } from "@/lib/authz";
import { Badge, Empty, PageHeader, sevTone, gradeTone, Sparkline } from "@/components/ui";
import { dateText, kpiText, money } from "@/lib/format";

export default async function Home() {
  const user = await requireUser();
  const store = getStore();
  const exceptions = dal.listExceptions(user);
  const work = dal.myWork(user);
  const props = dal.listProperties(user).filter((p) => p.financials);
  const pipeline = can(user, "view_deal_financials", { type: "deal", department: "acquisitions" }) ? dal.pipelineKpi(user, store) : null;
  const ir = dal.irSummary(user);
  const renewals = dal.propertyRenewals(user).filter((r) => r.daysUntil !== null && r.daysUntil <= 60);
  const asana = [...store.state.syncRuns].reverse().find((r) => r.connector.startsWith("asana"));

  return (
    <>
      <PageHeader title={`Welcome, ${user.name}`} sub="Everything here is filtered to your permissions." />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2" aria-labelledby="exc">
          <h2 id="exc" className="font-semibold">Exceptions and decisions due</h2>
          {exceptions.length === 0 ? <p className="muted mt-2 text-sm">No open exceptions in your scope.</p> : (
            <ul className="mt-3 divide-y" style={{ borderColor: "var(--line)" }}>
              {exceptions.map((e) => (
                <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                  <div>
                    <Link href={`/exceptions/${e.id}`} className="font-medium">{e.title}</Link>
                    <div className="muted text-xs">Owner {e.owner} · target {dateText(e.targetDate)}{e.valueAtRisk ? ` · at risk ${money(e.valueAtRisk)}` : ""}</div>
                  </div>
                  <Badge tone={sevTone(e.severity)}>{e.severity}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4" aria-labelledby="mw">
          <h2 id="mw" className="font-semibold">My work</h2>
          <p className="muted mt-1 text-sm">{work.overdue.length} overdue · {work.upcoming.length} upcoming</p>
          <ul className="mt-2 space-y-1 text-sm">
            {[...work.overdue, ...work.upcoming].slice(0, 5).map((t) => (
              <li key={t.id}><a href={t.url} target="_blank" rel="noopener noreferrer">{t.name}</a> <span className="muted text-xs">due {dateText(t.due)}</span></li>
            ))}
          </ul>
          <Link href="/work" className="mt-2 inline-block text-sm">Open my work</Link>
        </section>

        {props.length > 0 ? (
          <section className="card p-4 lg:col-span-2" aria-labelledby="ops">
            <h2 id="ops" className="font-semibold">Property collections and occupancy</h2>
            <div className="overflow-x-auto"><table className="t mt-2">
              <thead><tr><th>Property</th><th>Collections</th><th>Grade</th><th>Occupancy</th><th>Trend</th></tr></thead>
              <tbody>
                {props.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/operations/${p.id}`}>{p.name}</Link></td>
                    <td>{kpiText(p.financials!.collections)}</td>
                    <td><Badge tone={gradeTone(p.financials!.collectionsGrade)}>{p.financials!.collectionsGrade}</Badge></td>
                    <td>{kpiText(p.financials!.occupancy)}</td>
                    <td><Sparkline label={`${p.name} occupancy trend`} values={p.financials!.trend.map((t) => t.occupancy)} /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </section>
        ) : null}

        {pipeline ? (
          <section className="card p-4" aria-labelledby="pipe">
            <h2 id="pipe" className="font-semibold">Deal pipeline</h2>
            <p className="mt-1 text-2xl font-semibold">{kpiText(pipeline.kpi)}</p>
            <p className="muted text-xs">Asking price basis, {pipeline.canonicalDeals} canonical deals, {pipeline.sourceRecords} source records collapsed.</p>
            <Link href="/deals" className="mt-2 inline-block text-sm">Open deals</Link>
          </section>
        ) : null}

        {ir ? (
          <section className="card p-4" aria-labelledby="irs">
            <h2 id="irs" className="font-semibold">Investor commitments (internal)</h2>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div><dt className="muted text-xs">Soft</dt><dd>{money(ir.soft)}</dd></div>
              <div><dt className="muted text-xs">Signed</dt><dd>{money(ir.signed)}</dd></div>
              <div><dt className="muted text-xs">Collected</dt><dd>{money(ir.collected)}</dd></div>
            </dl>
          </section>
        ) : null}

        {renewals.length > 0 ? (
          <section className="card p-4" aria-labelledby="ren">
            <h2 id="ren" className="font-semibold">Renewals in 60 days</h2>
            <ul className="mt-2 space-y-1 text-sm">{renewals.map((r) => (<li key={r.id}>{r.propertyName}: {r.type} <span className="muted text-xs">in {r.daysUntil} days</span></li>))}</ul>
          </section>
        ) : null}

        <section className="card p-4 lg:col-span-3" aria-labelledby="fresh">
          <h2 id="fresh" className="font-semibold">Data freshness</h2>
          <p className="muted mt-1 text-sm">
            {process.env.CCOS_MODE === "live" ? "Live mode." : "Demo mode: all numbers are synthetic fixtures."}{" "}
            Asana sync: {asana ? `${asana.ok ? "ok" : "failed"} at ${asana.finishedAt.slice(0, 16).replace("T", " ")} (${asana.fetched} records, fixture adapter)` : "not run yet"}.
            Rent Manager: not connected.
          </p>
        </section>

        {exceptions.length === 0 && props.length === 0 && !pipeline && !ir ? <div className="lg:col-span-3"><Empty title="Nothing to show yet">Your account has no dashboards assigned. Ask an administrator for a role.</Empty></div> : null}
      </div>
    </>
  );
}
