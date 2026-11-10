import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import * as dal from "@/lib/dal";
import { Badge, Crumbs, ExtLink, PageHeader, sevTone } from "@/components/ui";
import { dateText, money } from "@/lib/format";

export default async function ExceptionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const e = dal.getException(user, id);
  if (!e) notFound();
  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Exception" }]} />
      <PageHeader title={e.title} actions={<Badge tone={sevTone(e.severity)}>{e.severity}</Badge>} />
      <dl className="card grid gap-4 p-4 sm:grid-cols-2">
        <div><dt className="muted text-xs">Root cause</dt><dd>{e.rootCause}</dd></div>
        <div><dt className="muted text-xs">Accountable owner</dt><dd>{e.owner}</dd></div>
        <div><dt className="muted text-xs">Next action</dt><dd>{e.nextAction}</dd></div>
        <div><dt className="muted text-xs">Target date</dt><dd>{dateText(e.targetDate)}</dd></div>
        <div><dt className="muted text-xs">Blocker</dt><dd>{e.blocker ?? "None recorded"}</dd></div>
        <div><dt className="muted text-xs">Value at risk</dt><dd>{money(e.valueAtRisk)}</dd></div>
        <div><dt className="muted text-xs">Evidence</dt><dd><ExtLink href={e.evidenceUrl}>Open source record</ExtLink></dd></div>
        <div><dt className="muted text-xs">Source task</dt><dd>{e.sourceTaskId ? <ExtLink href={`https://example.test/asana/${e.sourceTaskId}`}>Open Asana task</ExtLink> : "None"}</dd></div>
      </dl>
      <p className="muted mt-3 text-xs">Actions happen in the source system. This portal is read-only toward Asana, Rent Manager, Notion and Drive.</p>
    </>
  );
}
