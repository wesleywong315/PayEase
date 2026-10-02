import { describe, expect, it } from "vitest";
import { DEMO } from "../../prisma/demo-ids";
import {
  allocate,
  AllocationInputError,
  validateExpenseInputs,
} from "@/lib/allocation";
import { formatHkdFromCents } from "@/lib/money";

function baselinesById(
  result: ReturnType<typeof allocate>,
): Record<string, number> {
  return Object.fromEntries(
    result.lines.map((l) => [l.membershipId, l.baselineCents]),
  );
}

describe("allocation engine (SPEC §6.2)", () => {
  it("matches SPEC §10 training package baselines", () => {
    const result = allocate({
      fixedCents: DEMO.trainingFixedCents,
      variableCents: DEMO.trainingVariableCents,
      totalCents: DEMO.trainingTotalCents,
      participants: [
        { membershipId: DEMO.memberships.alex, usageUnits: 4 },
        { membershipId: DEMO.memberships.ben, usageUnits: 3 },
        { membershipId: DEMO.memberships.chloe, usageUnits: 2 },
        { membershipId: DEMO.memberships.dana, usageUnits: 1 },
      ],
    });

    expect(baselinesById(result)).toEqual(DEMO.trainingBaselinesCents);
    expect(result.warnings).toEqual([]);
    expect(
      result.lines.reduce((s, l) => s + l.baselineCents, 0),
    ).toBe(DEMO.trainingTotalCents);
  });

  it("splits transport equally after Dana leaves (largest-remainder tie-break)", () => {
    const result = allocate({
      fixedCents: DEMO.transportFixedCents,
      variableCents: 0,
      totalCents: DEMO.transportFixedCents,
      participants: [
        { membershipId: DEMO.memberships.alex, usageUnits: 0 },
        { membershipId: DEMO.memberships.ben, usageUnits: 0 },
        { membershipId: DEMO.memberships.chloe, usageUnits: 0 },
      ],
    });

    expect(baselinesById(result)).toEqual({
      mem_alex: 13334,
      mem_ben: 13333,
      mem_chloe: 13333,
    });
    expect(formatHkdFromCents(13334)).toBe("HK$133.34");
    expect(formatHkdFromCents(13333)).toBe("HK$133.33");
    expect(result.warnings).toEqual([]);
  });

  it("falls back to equal variable split when usage is all zero", () => {
    const result = allocate({
      fixedCents: 0,
      variableCents: 10000,
      totalCents: 10000,
      participants: [
        { membershipId: DEMO.memberships.alex, usageUnits: 0 },
        { membershipId: DEMO.memberships.ben, usageUnits: 0 },
      ],
    });

    expect(baselinesById(result)).toEqual({
      mem_alex: 5000,
      mem_ben: 5000,
    });
    expect(result.warnings).toEqual(["ZERO_USAGE_EQUAL_FALLBACK"]);
  });

  describe("validateExpenseInputs", () => {
    it("rejects empty participants", () => {
      expect(() =>
        validateExpenseInputs({
          fixedCents: 100,
          variableCents: 0,
          totalCents: 100,
          participants: [],
        }),
      ).toThrow(AllocationInputError);
    });

    it("rejects negative amounts", () => {
      expect(() =>
        validateExpenseInputs({
          fixedCents: -1,
          variableCents: 0,
          totalCents: -1,
          participants: [
            { membershipId: DEMO.memberships.alex, usageUnits: 0 },
          ],
        }),
      ).toThrow(AllocationInputError);
    });

    it("rejects total mismatch", () => {
      expect(() =>
        validateExpenseInputs({
          fixedCents: 100,
          variableCents: 50,
          totalCents: 200,
          participants: [
            { membershipId: DEMO.memberships.alex, usageUnits: 1 },
          ],
        }),
      ).toThrow(AllocationInputError);
    });

    it("rejects non-integer money and usage", () => {
      expect(() =>
        validateExpenseInputs({
          fixedCents: 10.5,
          variableCents: 0,
          totalCents: 10.5,
          participants: [
            { membershipId: DEMO.memberships.alex, usageUnits: 0 },
          ],
        }),
      ).toThrow(AllocationInputError);

      expect(() =>
        validateExpenseInputs({
          fixedCents: 100,
          variableCents: 0,
          totalCents: 100,
          participants: [
            { membershipId: DEMO.memberships.alex, usageUnits: 1.5 },
          ],
        }),
      ).toThrow(AllocationInputError);
    });

    it("rejects duplicate membershipIds", () => {
      expect(() =>
        validateExpenseInputs({
          fixedCents: 100,
          variableCents: 0,
          totalCents: 100,
          participants: [
            { membershipId: DEMO.memberships.alex, usageUnits: 0 },
            { membershipId: DEMO.memberships.alex, usageUnits: 1 },
          ],
        }),
      ).toThrow(AllocationInputError);
    });
  });
});
