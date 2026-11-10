import { describe, expect, it } from "vitest";
import * as k from "@/lib/kpi";

describe("physical occupancy", () => {
  it("uses operational rentable sites as the denominator", () => expect(k.physicalOccupancy(90, 100).value).toBe(90));
  it("is unavailable, not zero, when data is missing", () => {
    const r = k.physicalOccupancy(undefined, 100);
    expect(r.value).toBeNull();
    expect(r.status).toBe("unavailable");
  });
  it("rejects occupied above rentable", () => expect(k.physicalOccupancy(120, 100).status).toBe("unavailable"));
  it("rejects zero denominators", () => expect(k.physicalOccupancy(0, 0).value).toBeNull());
});

describe("current period collections", () => {
  it("divides allocated payments by net current charges", () => expect(k.currentPeriodCollections(9500, 10000).value).toBe(95));
  it("flags values above 100 percent instead of hiding them", () => {
    const r = k.currentPeriodCollections(11000, 10000);
    expect(r.status).toBe("warning");
    expect(r.reason).toMatch(/Above 100/);
  });
  it("is unavailable when nothing is due", () => expect(k.currentPeriodCollections(0, 0).value).toBeNull());
});

describe("NOI", () => {
  const months = (n: number): k.MonthlyNoi[] => Array.from({ length: n }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, "0")}`, income: 100, expense: 40 }));
  it("TTM needs 12 complete months", () => expect(k.ttmNoi(months(11)).status).toBe("unavailable"));
  it("TTM sums income minus expense", () => expect(k.ttmNoi(months(12)).value).toBe(720));
  it("TTM never infers a missing expense", () => {
    const m = months(12);
    m[3] = { month: "2026-04", income: 100, expense: null };
    expect(k.ttmNoi(m).value).toBeNull();
  });
  it("T1 annualized is labelled and not TTM", () => {
    const r = k.t1AnnualizedNoi({ month: "2026-10", income: 100, expense: 40 });
    expect(r.value).toBe(720);
    expect(r.formula).toMatch(/not TTM/);
    expect(r.status).toBe("warning");
  });
});

describe("variance and move-ins", () => {
  it("variance is actual minus target", () => expect(k.businessPlanVariance(90, 100).value).toBe(-10));
  it("variance refuses mismatched periods", () => expect(k.businessPlanVariance(90, 100, false).value).toBeNull());
  it("net move-ins", () => expect(k.netMoveIns(5, 2).value).toBe(3));
});

describe("pipeline value", () => {
  it("counts a canonical deal once even with two source records", () => {
    const r = k.dealPipelineValue([
      { id: "a", canonicalId: "d1", stage: "LOI", basis: "asking_price", amount: 1_000_000 },
      { id: "b", canonicalId: "d1", stage: "LOI", basis: "asking_price", amount: 1_000_000 },
      { id: "c", canonicalId: "d2", stage: "Screen", basis: "asking_price", amount: 500_000 },
    ], "asking_price");
    expect(r.value).toBe(1_500_000);
    expect(r.counted).toBe(2);
  });
  it("does not mix bases", () => {
    const r = k.dealPipelineValue([{ id: "a", stage: "LOI", basis: "loi_price", amount: 900_000 }], "asking_price");
    expect(r.value).toBeNull();
  });
});

describe("IR commitments", () => {
  it("keeps soft, signed and collected separate", () => {
    const r = k.irCommitments([
      { investorId: "1", kind: "soft", amount: 100 },
      { investorId: "1", kind: "signed", amount: 50 },
      { investorId: "2", kind: "collected", amount: 25 },
    ]);
    expect([r.soft, r.signed, r.collected]).toEqual([100, 50, 25]);
  });
});

describe("collections grade", () => {
  it("95 passes, 90 to 95 watch, below 90 red", () => {
    expect(k.collectionsGrade(95)).toBe("pass");
    expect(k.collectionsGrade(94.9)).toBe("watch");
    expect(k.collectionsGrade(90)).toBe("watch");
    expect(k.collectionsGrade(89.9)).toBe("red");
    expect(k.collectionsGrade(null)).toBe("unavailable");
  });
});
