import Link from "next/link";
import type { SessionUser } from "@/lib/authz";
import { can } from "@/lib/authz";
import { defaultDb } from "@/lib/live-auth";
import { liveProperties } from "@/lib/dal/live-ops";
import { rentManagerConfigured } from "@/lib/connectors/rentmanager-live";
import { Badge, Empty, PageHeader } from "@/components/ui";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// Start here for real accounts. Only real numbers appear. Anything not connected says so.
export async function LiveHome({ user }: { user: SessionUser }) {
  const rows = await liveProperties(user, defaultDb());
  const withData = rows.filter((r) => r.occupied != null && r.rentable);
  const occ = withData.reduce((a, r) => a + (r.occupied ?? 0), 0);
  const sites = withData.reduce((a, r) => a + (r.rentable ?? 0), 0);
  const money = rows.filter((r) => r.charged != null && r.paid != null);
  const charged = money.reduce((a, r) => a + (r.charged ?? 0), 0);
  const paid = money.reduce((a, r) => a + (r.paid ?? 0), 0);
  const owedRows = rows.filter((r) => r.owed != null);
  const owed = owedRows.reduce((a, r) => a + (r.owed ?? 0), 0);
  const latest = rows.map((r) => r.asOf).filter((x): x is string => Boolean(x)).sort().at(-1);
  const rm = rentManagerConfigured();
  const sources: { name: string; state: string; tone: "good" | "warn" | "muted"; note: string }[] = [
    { name: "Rent Manager (live)", state: rm ? "Connected" : "Not connected", tone: rm ? "good" : "warn", note: rm ? "Occupancy refreshes daily." : "Waiting for the Rent Manager login to be added in Vercel." },
    { name: "Uploaded weekly packets", state: latest ? "Has data" : "Nothing uploaded", tone: latest ? "good" : "muted", note: latest ? `Latest report ${day(latest)}.` : "Owner or ops manager can upload from Upload data." },
    { name: "Asana tasks", state: "Not connected", tone: "warn", note: "Tasks and follow-ups appear here once Asana is connected." },
    { name: "Notion manuals and Drive journals", state: "Not connected", tone: "muted", note: "Links per property are coming." },
  ];
  return (
    <>
      <PageHeader title="Start here" sub={`Welcome, ${user.name}. Only real numbers are shown. Anything not connected yet says so.`} />
      {rows.length === 0 ? (
        <Empty title="No properties are shared with you yet">Ask the owner to give your account access to the properties you work on.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card p-4"><div className="muted text-xs">Occupancy</div><div className="mt-1 text-2xl font-semibold">{sites ? `${((occ / sites) * 100).toFixed(1)}%` : "Unavailable"}</div><div className="muted text-xs">{sites ? `${occ} of ${sites} sites, ${withData.length} of ${rows.length} properties with data` : "No data yet"}</div></div>
          <div className="card p-4"><div className="muted text-xs">Collected so far this month</div><div className="mt-1 text-2xl font-semibold">{charged ? `${((paid / charged) * 100).toFixed(1)}%` : "Unavailable"}</div><div className="muted text-xs">{charged ? `${usd(paid)} of ${usd(charged)}, ${money.length} properties` : "From uploaded packets only"}</div></div>
          <div className="card p-4"><div className="muted text-xs">Owed by residents</div><div className="mt-1 text-2xl font-semibold">{owedRows.length ? usd(owed) : "Unavailable"}</div><div className="muted text-xs">{owedRows.length ? `${owedRows.length} properties` : "From uploaded packets only"}</div></div>
        </div>
      )}
      {rows.length > 0 ? (
        <section className="mt-6" aria-labelledby="props"><h2 id="props" className="mb-2 text-lg font-semibold">Properties</h2>
          <div className="card overflow-x-auto"><table className="t"><thead><tr><th>Property</th><th>Occupancy</th><th>As of</th></tr></thead><tbody>
            {rows.map((r) => (
              <tr key={r.id}><td>{r.name}</td><td>{r.occupied != null && r.rentable ? `${((r.occupied / r.rentable) * 100).toFixed(1)}% (${r.occupied}/${r.rentable})` : "Unavailable"}</td><td>{r.asOf ? day(r.asOf) : "No data yet"}</td></tr>
            ))}
          </tbody></table></div>
          <p className="muted mt-2 text-xs"><Link href="/operations">Open Operations</Link> for the full table.</p>
        </section>
      ) : null}
      <section className="mt-6" aria-labelledby="src"><h2 id="src" className="mb-2 text-lg font-semibold">Data sources</h2>
        <ul className="card divide-y">
          {sources.map((s) => (
            <li key={s.name} className="flex flex-wrap items-center justify-between gap-2 p-3"><div><div className="font-medium">{s.name}</div><div className="muted text-xs">{s.note}</div></div><Badge tone={s.tone}>{s.state}</Badge></li>
          ))}
        </ul>
        {can(user, "upload_data") ? <p className="mt-3 text-sm"><Link href="/upload">Upload this week&apos;s Rent Manager packet</Link></p> : null}
      </section>
    </>
  );
}
