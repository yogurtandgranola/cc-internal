import Link from "next/link";
import type { Kpi } from "@/lib/kpi";
import { kpiText } from "@/lib/format";

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="muted mb-2 text-xs">
      {items.map((c, i) => (
        <span key={c.label}>
          {i > 0 ? " / " : ""}
          {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {sub ? <p className="muted mt-1 text-sm">{sub}</p> : null}
      </div>
      {actions}
    </div>
  );
}

const TONE: Record<string, string> = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)", muted: "var(--muted)" };
export function Badge({ tone = "muted", children }: { tone?: "good" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium" style={{ borderColor: TONE[tone], color: TONE[tone] }}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: TONE[tone] }} />
      {children}
    </span>
  );
}

export const gradeTone = (g: string) => (g === "pass" ? "good" : g === "watch" ? "warn" : g === "red" ? "bad" : "muted") as "good" | "warn" | "bad" | "muted";
export const sevTone = (s: string) => (s === "high" ? "bad" : s === "medium" ? "warn" : "muted") as "bad" | "warn" | "muted";

// A metric always shows value, unit context, period, source, and as-of. Missing data says Unavailable and why.
export function Stat({ label, kpi, source, asOf, period, children }: { label: string; kpi: Kpi; source?: string | null; asOf?: string | null; period?: string | null; children?: React.ReactNode }) {
  const unavailable = kpi.value === null;
  return (
    <div className="card p-4" data-testid={`stat-${kpi.key}`}>
      <div className="muted text-xs font-medium uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={unavailable ? { color: "var(--muted)" } : undefined}>{kpiText(kpi)}</div>
      {unavailable ? <div className="mt-1 text-xs" style={{ color: "var(--warn)" }}>{kpi.reason}</div> : null}
      {kpi.status === "warning" && kpi.reason ? <div className="mt-1 text-xs" style={{ color: "var(--warn)" }}>{kpi.reason}</div> : null}
      {children}
      <details className="mt-2 text-xs">
        <summary className="muted cursor-pointer">Definition and source</summary>
        <p className="muted mt-1">{kpi.formula}</p>
        <p className="muted mt-1">
          Source: {source ?? "Not connected"}
          {period ? ` · Period: ${period}` : ""}
          {asOf ? ` · As of ${asOf.slice(0, 10)}` : ""}
        </p>
      </details>
    </div>
  );
}

export function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return <span className="muted text-xs">No trend</span>;
  const lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  const w = 96, h = 26;
  const x = (i: number) => 2 + (i / (values.length - 1)) * (w - 4);
  const y = (v: number) => 2 + (1 - (v - lo) / (hi - lo || 1)) * (h - 4);
  return (
    <svg role="img" aria-label={label} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke="var(--accent)" strokeWidth="1.8" points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")} />
    </svg>
  );
}

export function Freshness({ asOf, source, stale }: { asOf?: string | null; source?: string | null; stale?: boolean }) {
  if (!asOf) return <Badge tone="muted">Not connected</Badge>;
  return <Badge tone={stale ? "warn" : "good"}>{stale ? "Stale" : "Fresh"} · {source} · {asOf.slice(0, 10)}</Badge>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <p className="font-semibold">{title}</p>
      {children ? <p className="muted mt-1 text-sm">{children}</p> : null}
    </div>
  );
}

export function ExtLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <span className="muted">{children} (no link)</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}
