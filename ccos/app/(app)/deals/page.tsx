import Link from "next/link";
import { requireDepartment } from "@/lib/session";
import * as dal from "@/lib/dal";
import { Badge, Crumbs, Empty, PageHeader } from "@/components/ui";
import { dateText, money } from "@/lib/format";

const STAGES = ["Screening", "Underwriting", "LOI", "Contract", "Screened out"];

export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireDepartment("acquisitions");
  const deals = dal.listDeals(user, { stage: sp.stage || undefined, state: sp.state || undefined, q: sp.q || undefined, owner: sp.owner || undefined, utility: sp.utility || undefined });
  const all = dal.listDeals(user);
  const view = sp.view === "board" ? "board" : "table";
  const states = [...new Set(all.map((d) => d.state))].sort();
  const owners = [...new Set(all.map((d) => d.owner))].sort();
  const canFin = all.some((d) => d.financials);

  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Deals" }]} />
      <PageHeader title="Deals" sub="Canonical deals from the Deal Flow CRM. Duplicate Asana records are collapsed. Unknown fields stay unknown." />
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-3" method="get">
        <div><label htmlFor="q" className="muted block text-xs">Search</label><input id="q" name="q" defaultValue={sp.q} /></div>
        <div><label htmlFor="stage" className="muted block text-xs">Stage</label><select id="stage" name="stage" defaultValue={sp.stage ?? ""}><option value="">All</option>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label htmlFor="state" className="muted block text-xs">State</label><select id="state" name="state" defaultValue={sp.state ?? ""}><option value="">All</option>{states.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label htmlFor="owner" className="muted block text-xs">Owner</label><select id="owner" name="owner" defaultValue={sp.owner ?? ""}><option value="">All</option>{owners.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label htmlFor="utility" className="muted block text-xs">Utilities</label><select id="utility" name="utility" defaultValue={sp.utility ?? ""}><option value="">All</option>{["municipal", "private_septic", "wwtp", "lagoon", "unknown"].map((s) => <option key={s}>{s}</option>)}</select></div>
        <input type="hidden" name="view" value={view} />
        <button className="btn btn-primary">Apply filters</button>
        <Link href="/deals" className="btn">Clear</Link>
        <span className="ml-auto flex gap-2">
          <Link className="btn" href={`/deals?view=table`} aria-current={view === "table"}>Table</Link>
          <Link className="btn" href={`/deals?view=board`} aria-current={view === "board"}>Board</Link>
        </span>
      </form>

      {deals.length === 0 ? <Empty title="No deals match">Change or clear the filters.</Empty> : view === "board" ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5" data-testid="deal-board">
          {STAGES.map((s) => (
            <section key={s} className="card p-3" aria-label={s}>
              <h2 className="text-sm font-semibold">{s} <span className="muted">({deals.filter((d) => d.stage === s).length})</span></h2>
              <ul className="mt-2 space-y-2">
                {deals.filter((d) => d.stage === s).map((d) => (
                  <li key={d.id} className="rounded-md border p-2 text-sm" style={{ borderColor: "var(--line)" }}>
                    <Link href={`/deals/${d.id}`}>{d.name}</Link>
                    <div className="muted text-xs">{d.city}, {d.state} · {d.lots ?? "?"} lots</div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="t" data-testid="deal-table">
            <thead><tr><th>Deal</th><th>Stage</th><th>Location</th><th>Lots</th><th>Utility</th>{canFin ? <><th>Asking</th><th>NOI</th></> : null}<th>DD deadline</th><th>Owner</th><th>Screen</th></tr></thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id}>
                  <td><Link href={`/deals/${d.id}`}>{d.name}</Link>{d.kind === "portfolio" ? <span className="muted text-xs"> (portfolio)</span> : null}</td>
                  <td>{d.stage}</td><td>{d.city}, {d.state}</td><td>{d.lots ?? "Unknown"}</td><td>{d.utility.replace("_", " ")}</td>
                  {canFin ? <><td>{d.financials ? money(d.financials.askingPrice) : "Restricted"}</td><td>{d.financials ? money(d.financials.noi) : "Restricted"}</td></> : null}
                  <td>{dateText(d.ddDeadline)}</td><td>{d.owner}</td>
                  <td><Badge tone={d.screening.passes ? (d.screening.reasons.length ? "warn" : "good") : "bad"}>{d.screening.passes ? (d.screening.reasons.length ? "flag" : "pass") : "fails"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted mt-3 text-xs">Screening default: 50+ lots in one park, exclude WWTP and lagoon, flag private septic. Administrators can adjust these rules.</p>
    </>
  );
}
