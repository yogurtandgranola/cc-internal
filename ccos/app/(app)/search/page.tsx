import Link from "next/link";
import { requireUser } from "@/lib/session";
import * as dal from "@/lib/dal";
import { Crumbs, Empty, PageHeader } from "@/components/ui";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const hits = dal.search(user, q);
  return (
    <>
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Search" }]} />
      <PageHeader title="Search" sub="Only records you are allowed to see are searched. Counts and snippets never include anything else." />
      {q.trim().length < 2 ? <Empty title="Type at least two characters" /> : hits.length === 0 ? <Empty title={`No results for “${q}”`}>Check the spelling, or the record may be outside your access.</Empty> : (
        <ul className="card divide-y">
          {hits.map((h) => (
            <li key={h.type + h.id} className="p-3 text-sm">
              <span className="muted mr-2 text-xs uppercase">{h.type}</span>
              {h.href.startsWith("/") ? <Link href={h.href}>{h.title}</Link> : <a href={h.href} target="_blank" rel="noopener noreferrer">{h.title}</a>}
              {h.snippet ? <span className="muted"> · {h.snippet}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
