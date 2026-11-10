import { requireDepartment } from "@/lib/session";
import * as dal from "@/lib/dal";
import { Badge, Crumbs, PageHeader } from "@/components/ui";
import { dateText, money } from "@/lib/format";

export default async function IRPage() {
  const user = await requireDepartment("ir");
  const investors = dal.listInvestors(user);
  const sum = dal.irSummary(user);
  const tasks = dal.listTasks(user).filter((t) => t.department === "ir");
  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Investor Relations" }]} />
      <PageHeader title="Investor Relations" sub="Internal only. Not an investor-facing portal. Identities and amounts are restricted to approved staff." />
      {sum ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {[["Soft indications", sum.soft], ["Signed commitments", sum.signed], ["Collected capital", sum.collected]].map(([l, v]) => (
            <div key={String(l)} className="card p-4"><div className="muted text-xs uppercase">{l}</div><div className="mt-1 text-2xl font-semibold">{money(Number(v))}</div></div>
          ))}
          <p className="muted text-xs sm:col-span-3">{sum.formula}. Goal-versus-commitment tracking needs an approved fundraising target and is not shown until one is entered.</p>
        </div>
      ) : null}
      <div className="card overflow-x-auto">
        <table className="t" data-testid="investor-table">
          <thead><tr><th>Investor</th><th>Relationship</th><th>Last touch</th><th>Next touch</th><th>Commitments</th></tr></thead>
          <tbody>
            {investors.map((i) => (
              <tr key={i.id}>
                <td>{i.name}<div className="muted text-xs">{i.contactEmail}</div></td><td>{i.relationship}</td><td>{dateText(i.lastTouch)}</td><td>{dateText(i.nextTouch)}</td>
                <td>{i.commitments.length === 0 ? <span className="muted">None recorded</span> : i.commitments.map((c) => (<div key={c.kind + c.dealId}><Badge tone={c.kind === "soft" ? "warn" : "good"}>{c.kind}</Badge> {money(c.amount)} <span className="muted text-xs">{c.source}</span></div>))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="mt-6" aria-labelledby="ird"><h2 id="ird" className="mb-2 text-lg font-semibold">Outstanding deliverables</h2>
        {tasks.length === 0 ? <p className="muted text-sm">None in your scope.</p> : <ul className="card space-y-1 p-4 text-sm">{tasks.map((t) => (<li key={t.id}><a href={t.url} target="_blank" rel="noopener noreferrer">{t.name}</a> <span className="muted text-xs">due {dateText(t.due)}</span></li>))}</ul>}
      </section>
    </>
  );
}
