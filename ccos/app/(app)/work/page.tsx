import { requireUser } from "@/lib/session";
import * as dal from "@/lib/dal";
import { Badge, Crumbs, Empty, PageHeader } from "@/components/ui";
import { dateText } from "@/lib/format";

export default async function WorkPage() {
  const user = await requireUser();
  const w = dal.myWork(user);
  const all = dal.listTasks(user);
  const Row = ({ t, late }: { t: (typeof all)[number]; late?: boolean }) => (
    <tr><td><a href={t.url} target="_blank" rel="noopener noreferrer">{t.name}</a></td><td>{t.department}</td><td>{dateText(t.due)} {late ? <Badge tone="bad">overdue</Badge> : null}</td></tr>
  );
  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "My work" }]} />
      <PageHeader title="My work" sub="Tasks assigned to you, cached read-only from Asana. Open the task in Asana to change it." />
      {w.overdue.length + w.upcoming.length === 0 ? <Empty title="Nothing assigned to you">Tasks assigned to your email appear here after the next Asana sync.</Empty> : (
        <div className="card overflow-x-auto"><table className="t"><thead><tr><th>Task</th><th>Area</th><th>Due</th></tr></thead>
          <tbody>{w.overdue.map((t) => <Row key={t.id} t={t} late />)}{w.upcoming.map((t) => <Row key={t.id} t={t} />)}</tbody></table></div>
      )}
      <section className="mt-6" aria-labelledby="all"><h2 id="all" className="mb-2 text-lg font-semibold">All tasks in my scope</h2>
        <div className="card overflow-x-auto"><table className="t"><thead><tr><th>Task</th><th>Assignee</th><th>Due</th></tr></thead>
          <tbody>{all.map((t) => (<tr key={t.id}><td><a href={t.url} target="_blank" rel="noopener noreferrer">{t.name}</a></td><td>{t.assignee}</td><td>{dateText(t.due)}</td></tr>))}</tbody></table></div>
      </section>
    </>
  );
}
