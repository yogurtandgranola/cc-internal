import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import * as dal from "@/lib/dal";
import { startHere, type PlanRow } from "@/lib/dal/start-here";
import { can } from "@/lib/authz";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { kpiText, money, pct } from "@/lib/format";

const ASANA = (gid: string) => `https://app.asana.com/0/${gid}/list`;
const planTone = (s: PlanRow["status"]) => (s === "ahead" ? "good" : s === "on_track" ? "muted" : s === "behind" ? "bad" : "warn") as "good" | "warn" | "bad" | "muted";
const planText: Record<PlanRow["status"], string> = { ahead: "Ahead of plan", on_track: "On track", behind: "Behind plan", no_plan: "No approved plan", unavailable: "Unavailable" };
const stateTone = (s: string) => (s === "live" ? "good" : s === "error" ? "bad" : s === "demo" ? "warn" : "muted") as "good" | "warn" | "bad" | "muted";
const stateText: Record<string, string> = { live: "Live", demo: "Demo data", error: "Sync failed", not_connected: "Not connected", links_only: "Links only" };

function Link2({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  return external ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <Link href={href}>{children}</Link>;
}

export default async function Home() {
  const user = await requireUser();
  const store = getStore();
  const s = startHere(user, store);
  const depts = dal.visibleDepartments(user);
  const pipeline = can(user, "view_deal_financials", { type: "deal", department: "acquisitions" }) ? dal.pipelineKpi(user, store) : null;
  const ir = dal.irSummary(user);
  const props = dal.listProperties(user);
  const hasProps = s.portfolio.propertiesTotal > 0;
  const nothing = s.actions.length === 0 && s.followUps.length === 0 && !hasProps && !pipeline && !ir;

  const links: { label: string; href: string }[] = [];
  if (depts.includes("acquisitions")) links.push({ label: "Asana: Deal Flow CRM", href: ASANA("1210103657050285") });
  if (depts.includes("operations")) links.push({ label: "Asana: Operations", href: ASANA("1212008883960421") });
  if (depts.includes("ir")) links.push({ label: "Asana: Investor Team", href: ASANA("1212599842540169") });

  return (
    <>
      <PageHeader title="Start here" sub={`Welcome, ${user.name}. Today is ${s.today}. Everything below is filtered to your permissions.`} />

      {hasProps ? (
        <section aria-labelledby="kpis" className="mb-4">
          <h2 id="kpis" className="sr-only">Portfolio snapshot</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-4" data-testid="kpi-occupancy">
              <div className="muted text-xs font-medium uppercase tracking-wide">Occupancy</div>
              <div className="mt-1 text-2xl font-semibold">{s.portfolio.occupancy.value === null ? "Unavailable" : pct(s.portfolio.occupancy.value)}</div>
              <div className="muted mt-1 text-xs">{s.portfolio.occupancy.reporting} of {s.portfolio.propertiesTotal} properties reporting</div>
            </div>
            <div className="card p-4" data-testid="kpi-collections">
              <div className="muted text-xs font-medium uppercase tracking-wide">Collections, current period</div>
              <div className="mt-1 text-2xl font-semibold">{s.portfolio.collections.value === null ? "Unavailable" : pct(s.portfolio.collections.value)}</div>
              <div className="mt-1 flex flex-wrap gap-1 text-xs">
                <Badge tone="good">{s.portfolio.grades.pass} pass</Badge>
                <Badge tone="warn">{s.portfolio.grades.watch} watch</Badge>
                <Badge tone="bad">{s.portfolio.grades.red} red</Badge>
                {s.portfolio.grades.unavailable ? <Badge tone="muted">{s.portfolio.grades.unavailable} no data</Badge> : null}
              </div>
            </div>
            <div className="card p-4">
              <div className="muted text-xs font-medium uppercase tracking-wide">Needs action</div>
              <div className="mt-1 text-2xl font-semibold">{s.actions.length}</div>
              <div className="muted mt-1 text-xs">{s.counts.exceptions} open exceptions · {s.counts.myOpen} of your tasks open</div>
            </div>
            <div className="card p-4">
              <div className="muted text-xs font-medium uppercase tracking-wide">Data as of</div>
              <div className="mt-1 text-2xl font-semibold">{s.portfolio.asOf ? s.portfolio.asOf.slice(0, 10) : "Unavailable"}</div>
              <div className="mt-1 text-xs" style={s.portfolio.stale ? { color: "var(--warn)" } : undefined}>{s.portfolio.stale ? "Some properties are stale (over 40 days)" : "Latest Rent Manager period"}</div>
            </div>
          </div>
          <p className="muted mt-2 text-xs">Occupancy is weighted by rentable sites. Collections is a simple average of properties with data. Thresholds: 95% pass, 90% to 95% watch, under 90% red.</p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2" aria-labelledby="act">
          <h2 id="act" className="font-semibold">Needs action ({s.actions.length})</h2>
          {s.actions.length === 0 ? <p className="muted mt-2 text-sm">Nothing needs action in your scope.</p> : (
            <ul className="mt-3 divide-y" style={{ borderColor: "var(--line)" }}>
              {s.actions.slice(0, 10).map((a) => (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                  <div>
                    <Link2 href={a.href} external={a.external}>{a.title}</Link2>
                    <div className="muted text-xs">{a.detail}</div>
                  </div>
                  <Badge tone={a.tone}>{a.kind === "overdue_task" ? "Overdue" : a.kind === "exception" ? "Exception" : a.kind === "deadline" ? "Deadline" : a.kind === "blocked_deal" ? "Blocked" : "Verify"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4" aria-labelledby="fu">
          <h2 id="fu" className="font-semibold">Follow up ({s.followUps.length})</h2>
          {s.followUps.length === 0 ? <p className="muted mt-2 text-sm">No follow-ups waiting.</p> : (
            <ul className="mt-2 space-y-2 text-sm">
              {s.followUps.slice(0, 8).map((f) => (
                <li key={f.id}><Link2 href={f.href} external={f.external}>{f.title}</Link2><div className="muted text-xs">{f.detail}</div></li>
              ))}
            </ul>
          )}
          <Link href="/work" className="mt-2 inline-block text-sm">Open my work</Link>
        </section>

        {hasProps ? (
          <section className="card p-4 lg:col-span-3" aria-labelledby="plan">
            <h2 id="plan" className="font-semibold">Business plan vs actual</h2>
            <div className="mt-2 overflow-x-auto"><table className="t">
              <thead><tr><th>Property</th><th>Plan</th><th>Occupancy</th><th>Target</th><th>TTM NOI</th><th>Target NOI</th><th>Variance</th><th>Status</th></tr></thead>
              <tbody>
                {s.plan.map((r) => (
                  <tr key={r.propertyId}>
                    <td><Link href={`/operations/${r.propertyId}`}>{r.name}</Link></td>
                    <td>{r.planVersion ?? "None"}</td>
                    <td>{kpiText(r.occupancy)}</td>
                    <td>{r.targetOccupancy === null ? "Unavailable" : pct(r.targetOccupancy)}</td>
                    <td>{kpiText(r.ttmNoi)}</td>
                    <td>{r.targetTtmNoi === null ? "Unavailable" : money(r.targetTtmNoi)}</td>
                    <td>{kpiText(r.noiVariance)}</td>
                    <td><Badge tone={planTone(r.status)}>{planText[r.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <p className="muted mt-2 text-xs">Source: {s.plan[0]?.source ?? "Not connected"} · as of {s.portfolio.asOf?.slice(0, 10) ?? "unknown"}. A missing plan shows as such and is never treated as zero.</p>
          </section>
        ) : null}

        {s.budget.length > 0 ? (
          <section className="card p-4 lg:col-span-2" aria-labelledby="bud">
            <h2 id="bud" className="font-semibold">Infill project budget vs spend</h2>
            <div className="mt-2 overflow-x-auto"><table className="t">
              <thead><tr><th>Property</th><th>Budget</th><th>Spent</th><th>% spent</th><th>Next stage</th><th>Risk</th></tr></thead>
              <tbody>
                {s.budget.map((b) => (
                  <tr key={b.propertyId}>
                    <td><Link href={`/operations/${b.propertyId}`}>{b.name}</Link></td>
                    <td>{money(b.budget)}</td><td>{money(b.spent)}</td><td>{b.pctSpent === null ? "Unavailable" : pct(b.pctSpent, 0)}</td>
                    <td>{b.nextStage ?? "Complete"}</td><td>{b.risk ?? "None logged"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </section>
        ) : null}

        <section className="card p-4" aria-labelledby="up">
          <h2 id="up" className="font-semibold">Coming up (90 days)</h2>
          {s.upcoming.length === 0 ? <p className="muted mt-2 text-sm">Nothing scheduled.</p> : (
            <ul className="mt-2 space-y-2 text-sm">
              {s.upcoming.map((x) => (
                <li key={x.id}><Link2 href={x.href} external={x.kind === "Task"}>{x.label}</Link2><div className="muted text-xs">{x.kind} · {x.date}</div></li>
              ))}
            </ul>
          )}
        </section>

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

        {links.length > 0 || props.some((p) => p.links && Object.keys(p.links).length > 0) ? (
          <section className="card p-4 lg:col-span-2" aria-labelledby="tools">
            <h2 id="tools" className="font-semibold">Jump to your tools</h2>
            {links.length > 0 ? <ul className="mt-2 flex flex-wrap gap-2 text-sm">{links.map((l) => (<li key={l.label}><a className="btn" href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a></li>))}</ul> : null}
            <div className="mt-3 overflow-x-auto"><table className="t">
              <thead><tr><th>Property</th><th>Property manual (Notion)</th><th>Journal and files (Drive)</th><th>Tasks (Asana)</th><th>Rent Manager</th></tr></thead>
              <tbody>
                {props.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/operations/${p.id}`}>{p.name}</Link></td>
                    {(["notion", "drive", "asana", "rentManager"] as const).map((k) => (
                      <td key={k}>{p.links[k] ? <a href={p.links[k]} target="_blank" rel="noopener noreferrer">Open</a> : <span className="muted">No link</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table></div>
          </section>
        ) : null}

        <section className="card p-4" aria-labelledby="src">
          <h2 id="src" className="font-semibold">Data sources</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {s.sources.map((x) => (
              <li key={x.name}><span className="font-medium">{x.name}</span> <Badge tone={stateTone(x.state)}>{stateText[x.state]}</Badge><div className="muted text-xs">{x.role}. {x.detail}</div></li>
            ))}
          </ul>
          {hasProps ? (
            <details className="mt-3 text-xs">
              <summary className="muted cursor-pointer">Not available yet</summary>
              <ul className="muted mt-1 list-disc pl-4">{s.unavailable.map((u) => (<li key={u.metric}><strong>{u.metric}.</strong> {u.reason}</li>))}</ul>
            </details>
          ) : null}
        </section>

        {nothing ? <div className="lg:col-span-3"><Empty title="Nothing to show yet">Your account has no dashboards assigned. Ask an administrator for a role.</Empty></div> : null}
      </div>
    </>
  );
}
