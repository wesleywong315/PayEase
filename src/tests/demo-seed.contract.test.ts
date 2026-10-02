import { describe, expect, it } from "vitest";
import { DEMO } from "../../prisma/demo-ids";

describe("demo seed contract (SPEC §10)", () => {
  it("uses stable community and cycle ids", () => {
    expect(DEMO.communityId).toBe("demo-community-hku-hall-football");
    expect(DEMO.communityName).toBe("HKU Hall Football Team");
    expect(DEMO.cycleId).toBe("demo-cycle-autumn-2026");
    expect(DEMO.cycleName).toBe("Autumn 2026");
  });

  it("uses stable membership ids for rounding tie-breaks", () => {
    expect(DEMO.memberships).toEqual({
      alex: "mem_alex",
      ben: "mem_ben",
      chloe: "mem_chloe",
      dana: "mem_dana",
    });
  });

  it("matches training package money and baselines", () => {
    expect(DEMO.trainingFixedCents).toBe(40000);
    expect(DEMO.trainingVariableCents).toBe(80000);
    expect(DEMO.trainingTotalCents).toBe(120000);
    expect(DEMO.trainingBaselinesCents).toEqual({
      mem_alex: 42000,
      mem_ben: 34000,
      mem_chloe: 26000,
      mem_dana: 18000,
    });
    const sum = Object.values(DEMO.trainingBaselinesCents).reduce((a, b) => a + b, 0);
    expect(sum).toBe(DEMO.trainingTotalCents);
  });

  it("matches hardship funding and pending Dana cap", () => {
    expect(DEMO.hardshipReceivedCents).toBe(8000);
    expect(DEMO.danaCapCents).toBe(10000);
    expect(DEMO.transportFixedCents).toBe(40000);
  });
});
