import Link from "next/link";
import { requireDepartment } from "@/lib/session";
import { getStore } from "@/lib/store";
import * as dal from "@/lib/dal";
import { Badge, Crumbs, Freshness, PageHeader, Sparkline, gradeTone } from "@/components/ui";
import { dateText, kpiText } from "@/lib/format";
import { defaultDb } from "@/lib/live-auth";
import { liveProperties } from "@/lib/dal/live-ops";
import { rentManagerConfigured } from "@/lib/connectors/rentmanager-live";

export default async function OperationsPage() {
  const user = await requireDepartment("operations");
  if (user.live) {
    const rows = await liveProperties(user, defaultDb());
    const connected = rentManagerConfigured();
    return (
      <>
        <Crumbs items={[{ label: "Home", href: "/" }, { label: "Operations" }]} />
        <PageHeader title="Operations" sub="Live occupancy from Rent Manager, refreshed daily. Only the properties you have access to are shown." />
        {!connected ? <p className="card mb-4 p-3" role="status">Rent Manager is not connected yet. The owner adds the Rent Manager login in Vercel, then numbers appear here after the next refresh.</p> : null}
        <div className="card overflow-x-auto">
          <table className="t" data-testid="property-table">
            <thead><tr><th>Property</th><th>Occupied sites</th><th>Total sites</th><th>Occupancy</th><th>As of</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}{r.city ? <div className="muted text-xs">{r.city}, {r.state}</div> : null}</td>
                  <td>{r.occupied ?? "Unavailable"}</td><td>{r.rentable ?? "Unavailable"}</td>
                  <td>{r.occupied != null && r.rentable ? `${((r.occupied / r.rentable) * 100).toFixed(1)}%` : "Unavailable"}</td>
                  <td>{r.asOf ? `${dateText(r.asOf)} (${r.source})` : "No data yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted mt-2 text-xs">Occupied means a current tenant in Rent Manager. Collections, budget and renewals are not live yet and are never estimated.</p>
      </>
    );
  }
  const props = dal.listProperties(user);
  const score = dal.pmScorecards(user, getStore());
  const renewals = dal.propertyRenewals(user);
  const cfg = getStore().state.kpiConfig;
  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Operations" }]} />
      <PageHeader title="Operations" sub="Portfolio grid, property manager scorecard, and renewals. Rent Manager is not connected, so demo figures are synthetic." />
      <div className="card overflow-x-auto">
        <table className="t" data-testid="property-table">
          <thead><tr><th>Property</th><th>Occupancy</th><th>Collections</th><th>TTM NOI</th><th>vs plan</th><th>Trend</th><th>Freshness</th></tr></thead>
          <tbody>
            {props.map((p) => {
              const f = p.financials;
              return (
                <tr key={p.id}>
                  <td><Link href={`/operations/${p.id}`}>{p.name}</Link><div className="muted text-xs">{p.city}, {p.state}</div></td>
                  <td>{f ? kpiText(f.occupancy) : "Restricted"}</td>
                  <td>{f ? kpiText(f.collections) : "Restricted"}</td>
                  <td>{f ? kpiText(f.ttmNoi) : "Restricted"}</td>
                  <td>{f ? kpiText(f.variance) : "Restricted"}</td>
                  <td>{f ? <Sparkline label={`${p.name} occupancy trend`} values={f.trend.map((t) => t.occupancy)} /> : null}</td>
                  <td>{f ? <Freshness asOf={f.asOf} source={f.source} stale={f.stale} /> : <Badge>n/a</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {score.length > 0 ? (
        <section className="mt-6" aria-labelledby="pm">
          <h2 id="pm" className="mb-2 text-lg font-semibold">Property manager scorecard</h2>
          <div className="card overflow-x-auto">
            <table className="t">
              <thead><tr><th>Property</th><th>Current-period collections</th><th>Grade</th><th>Occupancy</th><th>Net move-ins</th></tr></thead>
              <tbody>
                {score.map((s) => (
                  <tr key={s.propertyId}>
                    <td>{s.name}</td><td>{kpiText(s.collections)}</td><td><Badge tone={gradeTone(s.grade)}>{s.grade}</Badge></td><td>{kpiText(s.occupancy)}</td><td>{kpiText(s.netMoveIns)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted mt-2 text-xs">Agreed: {cfg.collectionsPass}% passes, below {cfg.collectionsRed}% is red, in between is watch. Occupancy, move-in, work-order and reporting thresholds are proposed and configurable until approved. Property-manager self-report is not used.</p>
        </section>
      ) : null}

      {renewals.length > 0 ? (
        <section className="mt-6" aria-labelledby="ren">
          <h2 id="ren" className="mb-2 text-lg font-semibold">Upcoming renewals</h2>
          <div className="card overflow-x-auto">
            <table className="t">
              <thead><tr><th>Property</th><th>Type</th><th>Due</th><th>Days</th><th>Owner</th><th>Verified by</th><th>SOP</th></tr></thead>
              <tbody>
                {renewals.map((r) => (
                  <tr key={r.id}>
                    <td>{r.propertyName}</td><td>{r.type}</td><td>{r.dueDate ? dateText(r.dueDate) : <Badge tone="warn">Unknown, verify</Badge>}</td>
                    <td>{r.daysUntil ?? ""}</td><td>{r.owner}</td><td>{r.verifiedBy ?? <span className="muted">Not verified</span>}</td>
                    <td>{r.sopUrl ? <a href={r.sopUrl} target="_blank" rel="noopener noreferrer">SOP</a> : <span className="muted">None</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted mt-2 text-xs">Reminders are proposed at 120/90/60/45/30 days by type. This portal does not send them automatically.</p>
        </section>
      ) : null}
    </>
  );
}
