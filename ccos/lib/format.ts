import type { Kpi } from "./kpi";

export const money = (n: number | null | undefined) =>
  n === null || n === undefined ? "Unavailable" : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString("en-US")}`;
export const pct = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? "Unavailable" : `${n.toFixed(d)}%`);
export const kpiText = (k: Kpi) => (k.value === null ? "Unavailable" : k.unit === "%" ? pct(k.value) : k.unit === "$" ? money(k.value) : String(k.value));
export const dateText = (s?: string | null) => (s ? s.slice(0, 10) : "Unknown");
