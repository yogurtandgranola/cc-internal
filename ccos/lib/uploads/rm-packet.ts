// Reads the Rent Manager "Weekly Reports Packet" PDF (text already pulled out page by page).
// Pure and read-only. It keeps only per-property totals. Tenant names and balances per person are never kept.
export type PacketRow = {
  propertyName: string;
  month: string; // first day of the month the report covers, YYYY-MM-01
  asOf: string; // YYYY-MM-DD, the report run date
  rentable: number;
  occupied: number;
  chargesDue: number | null;
  paid: number | null;
  delinquent: number | null;
  moveIns: number | null;
  moveOuts: number | null;
  warnings: string[];
};

const num = (s: string) => Number(s.replace(/,/g, ""));
const dateFromUs = (s: string) => {
  const m = /^(\d\d)\/(\d\d)\/(\d\d)$/.exec(s);
  return m ? `20${m[3]}-${m[1]}-${m[2]}` : null;
};
const MONEY = "(-?[\\d,]+\\.\\d\\d)";
const TOTALS = new RegExp(`Total\\s+Charged\\s+${MONEY}\\s+Total Paid\\s+${MONEY}\\s+Credit\\s+Balances\\s+${MONEY}\\s+Debit\\s+Balances\\s+${MONEY}\\s+Total Units:\\s*([\\d,]+)\\s+Vacant Units:\\s*([\\d,]+)`, "g");

export function parsePacket(pages: string[]): { rows: PacketRow[]; problems: string[] } {
  const by = new Map<string, PacketRow>();
  const problems: string[] = [];
  const get = (name: string, asOf: string, month: string) => {
    let r = by.get(name);
    if (!r) { r = { propertyName: name, month, asOf, rentable: 0, occupied: 0, chargesDue: null, paid: null, delinquent: null, moveIns: null, moveOuts: null, warnings: [] }; by.set(name, r); }
    return r;
  };
  let sawRentRoll = false;
  for (const page of pages) {
    const prop = /Property:\s*([^\n]+)/.exec(page)?.[1]?.trim();
    if (!prop) continue;
    const run = /RentManager\.com\s+(\d\d\/\d\d\/\d\d)/.exec(page)?.[1];
    const asOf = (run && dateFromUs(run)) || "";
    const period = /in the period\s+(\d\d\/\d\d\/\d\d)/.exec(page)?.[1] ?? /From\s+(\d\d\/\d\d\/\d\d)\s+to/.exec(page)?.[1];
    const start = period ? dateFromUs(period) : null;
    const month = start ? `${start.slice(0, 7)}-01` : asOf ? `${asOf.slice(0, 7)}-01` : "";
    if (/Summary Rent Roll/.test(page)) {
      const all = [...page.matchAll(TOTALS)];
      const t = all.at(-1);
      if (t) {
        sawRentRoll = true;
        const r = get(prop, asOf, month);
        r.chargesDue = num(t[1]!); r.paid = num(t[2]!); r.delinquent = num(t[4]!);
        r.rentable = num(t[5]!);
        r.occupied = num(t[5]!) - num(t[6]!);
        if (asOf) { r.asOf = asOf; r.month = month; }
      }
    } else if (/Move In \/ Move Out/.test(page)) {
      const r = get(prop, asOf, month);
      const occ = [...page.matchAll(/Occupancy on (\d\d\/\d\d\/\d\d):\s*(\d+)/g)].at(-1);
      const mv = /(\d+):\s*Move Ins\s+(\d+):\s*Move Outs/.exec(page);
      if (mv) { r.moveIns = Number(mv[1]); r.moveOuts = Number(mv[2]); }
      if (occ) {
        const fromReport = Number(occ[2]);
        if (r.rentable && r.occupied !== fromReport) r.warnings.push(`Rent roll says ${r.occupied} occupied, move-in report says ${fromReport}. Using ${fromReport}.`);
        r.occupied = fromReport;
      }
    }
  }
  const rows = [...by.values()].filter((r) => r.rentable > 0);
  if (!sawRentRoll) problems.push("This does not look like a Rent Manager weekly packet. No Summary Rent Roll totals were found.");
  for (const r of rows) {
    if (!r.month || !r.asOf) problems.push(`${r.propertyName}: could not find the report date.`);
    if (r.occupied < 0 || r.occupied > r.rentable) problems.push(`${r.propertyName}: occupied sites (${r.occupied}) do not fit the total sites (${r.rentable}).`);
  }
  return { rows, problems };
}

export async function pdfPages(bytes: Uint8Array): Promise<string[]> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return text;
}
