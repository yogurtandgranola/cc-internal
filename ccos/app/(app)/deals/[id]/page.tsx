import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import * as dal from "@/lib/dal";
import { Badge, Crumbs, ExtLink, PageHeader } from "@/components/ui";
import { dateText, money, pct } from "@/lib/format";

export default async function DealDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const d = dal.getDeal(user, id);
  if (!d) notFound();
  const sources = dal.dealSourceRecords(user, id, getStore());
  const f = d.financials;
  const row = (label: string, value: React.ReactNode) => (<div><dt className="muted text-xs">{label}</dt><dd>{value}</dd></div>);
  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Deals", href: "/deals" }, { label: d.name }]} />
      <PageHeader title={d.name} sub={`${d.stage} · ${d.city}, ${d.state}`} actions={<Badge tone={d.decision === "active" ? "good" : "muted"}>{d.decision}</Badge>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4" aria-labelledby="facts">
          <h2 id="facts" className="font-semibold">Facts</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {row("Type", d.kind)}{row("Lots", d.lots ?? "Unknown")}{row("POH share", d.pohPct === null ? "Unknown" : pct(d.pohPct, 0))}
            {row("Occupancy", d.occupancy === null ? "Unknown" : pct(d.occupancy, 0))}{row("Utility", d.utility.replace("_", " "))}{row("Source", d.source)}
            {row("Owner", d.owner)}{row("Last contact", dateText(d.lastContact))}{row("Next action", d.nextAction ?? "None")}
            {row("Confidence", d.confidence)}
          </dl>
          {d.decisionReason ? <p className="mt-3 text-sm">Decision reason: {d.decisionReason}</p> : null}
        </section>
        <section className="card p-4" aria-labelledby="fin">
          <h2 id="fin" className="font-semibold">Financials</h2>
          {f ? (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {row("Asking price", money(f.askingPrice))}{row("LOI price", money(f.loiPrice))}{row("NOI", money(f.noi))}
              {row("Asking cap", f.askingCap === null ? "Unknown" : pct(f.askingCap))}{row("Underwriting", f.uwVersion ?? "No version linked")}{row("Lender", f.lender ?? "None")}
            </dl>
          ) : <p className="muted mt-2 text-sm">Deal financials are restricted for your role.</p>}
          <p className="muted mt-3 text-xs">Reported figures. Not verified live financials.</p>
        </section>
        <section className="card p-4" aria-labelledby="dd">
          <h2 id="dd" className="font-semibold">Diligence and financing</h2>
          <p className="mt-2 text-sm">DD deadline: {dateText(d.ddDeadline)}</p>
          <ul className="mt-2 list-disc pl-5 text-sm">{d.blockers.length ? d.blockers.map((b) => <li key={b}>{b}</li>) : <li>No blockers recorded</li>}</ul>
          <h3 className="mt-3 text-sm font-semibold">Screening</h3>
          <ul className="mt-1 list-disc pl-5 text-sm">{d.screening.reasons.length ? d.screening.reasons.map((r) => <li key={r}>{r}</li>) : <li>Passes default screen</li>}</ul>
        </section>
        <section className="card p-4" aria-labelledby="src">
          <h2 id="src" className="font-semibold">Source records and links</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li><ExtLink href={d.links.asana}>Asana deal</ExtLink></li>
            <li><ExtLink href={d.links.drive}>Diligence folder (Drive)</ExtLink></li>
            <li><ExtLink href={d.links.underwriting}>Approved underwriting output</ExtLink></li>
          </ul>
          <h3 className="mt-3 text-sm font-semibold">Linked source records (provenance)</h3>
          {sources.length === 0 ? <p className="muted text-sm">None synced yet. An administrator can run a sync.</p> : (
            <ul className="mt-1 text-sm">{sources.map((s) => (<li key={s.externalId}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> <span className="muted text-xs">Asana project {s.projectGid} · as of {s.asOf.slice(0, 10)}</span></li>))}</ul>
          )}
        </section>
      </div>
    </>
  );
}
