import { describe, expect, it } from "vitest";
import { collectionsTone, occupancyTone, owedTone } from "@/lib/live-status";

describe("live status colors", () => {
  it("colors occupancy", () => {
    expect(occupancyTone(95)).toBe("good"); expect(occupancyTone(85)).toBe("warn"); expect(occupancyTone(35)).toBe("bad"); expect(occupancyTone(null)).toBe("muted");
  });
  it("uses the agreed collections rule", () => {
    expect(collectionsTone(95)).toBe("good"); expect(collectionsTone(92)).toBe("warn"); expect(collectionsTone(89.9)).toBe("bad");
  });
  it("colors what residents owe by share of charges, else per occupied site", () => {
    expect(owedTone(0, 1000, 10)).toBe("good");
    expect(owedTone(150, 1000, 10)).toBe("warn");
    expect(owedTone(300, 1000, 10)).toBe("bad");
    expect(owedTone(27575, null, 31)).toBe("bad");
    expect(owedTone(377, null, 20)).toBe("good");
    expect(owedTone(null, null, null)).toBe("muted");
  });
});
