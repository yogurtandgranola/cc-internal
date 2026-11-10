import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import type { SessionUser } from "@/lib/authz";
import { can } from "@/lib/authz";
import { visibleDepartments } from "@/lib/dal";

export function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const depts = visibleDepartments(user);
  const demo = process.env.CCOS_MODE !== "live";
  const nav: { href: string; label: string }[] = [{ href: "/", label: "Home" }];
  if (depts.includes("acquisitions")) nav.push({ href: "/deals", label: "Deals" });
  if (depts.includes("operations")) nav.push({ href: "/operations", label: "Operations" });
  if (depts.includes("ir")) nav.push({ href: "/investor-relations", label: "Investor Relations" });
  if (depts.includes("executive")) nav.push({ href: "/executive", label: "Executive" });
  nav.push({ href: "/work", label: "My work" }, { href: "/ai", label: "AI analyst" });
  if (can(user, "manage_users")) nav.push({ href: "/admin", label: "Admin" });
  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">Skip to content</a>
      <aside className="border-b md:min-h-screen md:w-56 md:flex-none md:border-b-0 md:border-r" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <div className="px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent)" }}>Cornell Communities</div>
          <div className="text-lg font-bold">OS</div>
        </div>
        <nav aria-label="Primary" className="flex gap-1 overflow-x-auto px-2 pb-3 md:block md:space-y-1 md:overflow-visible">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="block whitespace-nowrap rounded-md px-3 py-2 text-sm no-underline hover:bg-black/5" style={{ color: "var(--ink)" }}>{n.label}</Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        {demo ? (
          <div role="status" data-testid="demo-banner" className="px-4 py-1.5 text-center text-xs font-semibold" style={{ background: "#fde68a", color: "#422006" }}>
            DEMO DATA · All records are synthetic and no external system is connected
          </div>
        ) : null}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6" style={{ borderColor: "var(--line)" }}>
          <form action="/search" role="search" className="flex gap-2">
            <label htmlFor="q" className="sr-only">Search authorized records</label>
            <input id="q" name="q" type="search" placeholder="Search properties, deals, tasks…" className="w-64 max-w-full" />
            <button className="btn">Search</button>
          </form>
          <div className="flex items-center gap-3 text-sm">
            <span className="muted" data-testid="whoami">{user.name} · {[...new Set(user.grants.map((g) => g.role))].join(", ")}</span>
            <form action={logoutAction}><button className="btn">Sign out</button></form>
          </div>
        </header>
        <main id="main" className="px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
