// Color rules for the live numbers. Thresholds are proposed and can be changed here in one place.
// Collections use the agreed rule: 95% and up passes, below 90% is red, in between is watch.
export type Tone = "good" | "warn" | "bad" | "muted";

export const THRESHOLDS = {
  occupancyGood: 90, occupancyWarn: 80,
  collectionsPass: 95, collectionsRed: 90,
  owedPctOfChargesWarn: 10, owedPctOfChargesBad: 20, // when charges are known
  owedPerOccupiedSiteWarn: 100, owedPerOccupiedSiteBad: 300, // when they are not
} as const;

export const occupancyTone = (pct: number | null): Tone =>
  pct == null ? "muted" : pct >= THRESHOLDS.occupancyGood ? "good" : pct >= THRESHOLDS.occupancyWarn ? "warn" : "bad";

export const collectionsTone = (pct: number | null): Tone =>
  pct == null ? "muted" : pct >= THRESHOLDS.collectionsPass ? "good" : pct < THRESHOLDS.collectionsRed ? "bad" : "warn";

export function owedTone(owed: number | null, charged: number | null, occupied: number | null): Tone {
  if (owed == null) return "muted";
  if (owed <= 0) return "good";
  if (charged && charged > 0) {
    const p = (owed / charged) * 100;
    return p >= THRESHOLDS.owedPctOfChargesBad ? "bad" : p >= THRESHOLDS.owedPctOfChargesWarn ? "warn" : "good";
  }
  if (occupied && occupied > 0) {
    const per = owed / occupied;
    return per >= THRESHOLDS.owedPerOccupiedSiteBad ? "bad" : per >= THRESHOLDS.owedPerOccupiedSiteWarn ? "warn" : "good";
  }
  return "muted";
}

export const toneColor = (t: Tone) => (t === "muted" ? "inherit" : `var(--${t})`);
export const toneWord: Record<Tone, string> = { good: "Healthy", warn: "Watch", bad: "Action needed", muted: "No data" };
