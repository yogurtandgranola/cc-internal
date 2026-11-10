import { route } from "@/lib/api";
import * as dal from "@/lib/dal";

const cell = (v: unknown) => { const s = String(v ?? ""); return /^[=+\-@]/.test(s) ? `'${s}` : s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; };
// CSV export uses the same scoped DAL as the UI. Spreadsheet formulas are neutralized.
export const GET = route(async (u) => {
  const rows = dal.listProperties(u).filter((p) => p.financials).map((p) => [p.name, p.financials!.month, p.financials!.occupancy.value?.toFixed(1) ?? "Unavailable", p.financials!.collections.value?.toFixed(1) ?? "Unavailable", p.financials!.asOf ?? "", p.financials!.source ?? "Not connected"]);
  const csv = [["property", "month", "occupancy_pct", "current_collections_pct", "as_of", "source"], ...rows].map((r) => r.map(cell).join(",")).join("\n");
  return new Response(csv, { headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=properties.csv", "Cache-Control": "private, no-store" } });
});
