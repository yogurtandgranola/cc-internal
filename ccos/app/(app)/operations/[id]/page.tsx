import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import * as dal from "@/lib/dal";
import { Badge, Crumbs, ExtLink, Freshness, PageHeader, Sparkline, Stat, gradeTone } from "@/components/ui";
import { dateText, money } from "@/lib/format";

export default async function PropertyDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const p = dal.getProperty(user, id);
  if (!p) notFound();
  const f = p.financials;
  const milestones = dal.propertyMilestones(user, id);
  const renewals = dal.propertyRenewals(user, id);
  const tasks = dal.propertyTasks(user, id);
  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Operations", href: "/operations" }, { label: p.name }]} />
      <PageHeader title={p.name} sub={`${p.city}, ${p.state}`} actions={f ? <Freshness asOf={f.asOf} source={f.source} stale={f.stale} /> : null} />

      {!f ? <div className="card p-4 text-sm">Financial metrics are restricted for your role.</div> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Physical occupancy" kpi={f.occupancy} source={f.source} asOf={f.asOf} period={f.month}>
              <div className="muted mt-1 text-xs">Licensed {f.licensedSites} · operational rentable {f.operationalRentableSites}</div>
            </Stat>
            <Stat label="Current-period collections" kpi={f.collections} source={f.source} asOf={f.asOf} period={f.month}>
              <div className="mt-1"><Badge tone={gradeTone(f.collectionsGrade)}>{f.collectionsGrade}</Badge></div>
            </Stat>
            <Stat label="TTM NOI" kpi={f.ttmNoi} source={f.source} asOf={f.asOf} period="trailing 12 months" />
            <Stat label="T1 annualized NOI" kpi={f.t1Noi} source={f.source} asOf={f.asOf} period={f.month} />
            <Stat label="Net move-ins" kpi={f.netMoveIns} source={f.source} asOf={f.asOf} period={f.month} />
            <Stat label="TTM NOI vs plan" kpi={f.variance} source={f.plan ? `Business plan ${f.plan.version}` : "No approved plan"} asOf={f.plan?.approvedAt ?? null} period="trailing 12 months" />
          </div>
          <section className="card mt-4 p-4" aria-labelledby="trend">
            <h2 id="trend" className="font-semibold">12-month trend</h2>
            <div className="mt-2 flex flex-wrap gap-6 text-sm">
              <div>Occupancy <Sparkline label="Occupancy trend" values={f.trend.map((t) => t.occupancy)} /></div>
              <div>Collections <Sparkline label="Collections trend" values={f.trend.map((t) => t.collections)} /></div>
              {f.mix ? <div>Mix: TOH {f.mix.toh} · POH {f.mix.poh} · RTO {f.mix.rto}</div> : <div className="muted">Home mix not reported</div>}
            </div>
            {f.plan ? <p className="muted mt-2 text-xs">Plan {f.plan.version}, approved {f.plan.approvedAt}: occupancy {f.plan.targetOccupancy}%, TTM NOI {money(f.plan.targetTtmNoi)}.</p> : <p className="mt-2 text-xs" style={{ color: "var(--warn)" }}>No approved business plan on file.</p>}
          </section>
        </>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {milestones.length > 0 ? (
          <section className="card p-4" aria-labelledby="inf">
            <h2 id="inf" className="font-semibold">Infill timeline</h2>
            <div className="overflow-x-auto"><table className="t mt-2">
              <thead><tr><th>Stage</th><th>Baseline</th><th>Forecast</th><th>Actual</th><th>Spent / budget</th></tr></thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.id}>
                    <td>{m.stage}{m.risk ? <div className="text-xs" style={{ color: "var(--warn)" }}>{m.risk}</div> : null}</td>
                    <td>{dateText(m.baseline)}</td><td>{dateText(m.forecast)}{m.slipDays ? <span className="muted text-xs"> ({m.slipDays > 0 ? "+" : ""}{m.slipDays}d)</span> : null}</td>
                    <td>{dateText(m.actual)}</td><td>{m.budget === null ? "No budget" : `${money(m.spent)} / ${money(m.budget)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </section>
        ) : null}
        <section className="card p-4" aria-labelledby="rn">
          <h2 id="rn" className="font-semibold">Renewals</h2>
          {renewals.length === 0 ? <p className="muted mt-2 text-sm">None tracked.</p> : (
            <ul className="mt-2 space-y-1 text-sm">{renewals.map((r) => (<li key={r.id}>{r.type}: {r.dueDate ? `${dateText(r.dueDate)} (${r.daysUntil} days)` : <Badge tone="warn">date unknown</Badge>} · {r.owner}{r.sopUrl ? <> · <a href={r.sopUrl} target="_blank" rel="noopener noreferrer">SOP</a></> : null}{r.asanaUrl ? <> · <a href={r.asanaUrl} target="_blank" rel="noopener noreferrer">Asana</a></> : null}</li>))}</ul>
          )}
        </section>
        <section className="card p-4" aria-labelledby="tk">
          <h2 id="tk" className="font-semibold">Tasks (from Asana)</h2>
          {tasks.length === 0 ? <p className="muted mt-2 text-sm">No open tasks in your scope.</p> : (
            <ul className="mt-2 space-y-1 text-sm">{tasks.map((t) => (<li key={t.id}><a href={t.url} target="_blank" rel="noopener noreferrer">{t.name}</a> <span className="muted text-xs">{t.assignee} · due {dateText(t.due)}</span></li>))}</ul>
          )}
        </section>
        <section className="card p-4" aria-labelledby="lk">
          <h2 id="lk" className="font-semibold">Source links</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li><ExtLink href={p.links.rentManager}>Rent Manager</ExtLink></li>
            <li><ExtLink href={p.links.notion}>Notion property manual</ExtLink></li>
            <li><ExtLink href={p.links.drive}>Drive documents</ExtLink></li>
            <li><ExtLink href={p.links.asana}>Asana project</ExtLink></li>
          </ul>
          {p.tenantDetailsAllowed ? <p className="muted mt-2 text-xs">Tenant-level detail stays in Rent Manager. Use the link above.</p> : <p className="muted mt-2 text-xs">Tenant details are restricted for your role.</p>}
        </section>
      </div>
    </>
  );
}
