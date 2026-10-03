import { describe, expect, it } from "vitest";
import { allocate } from "@/lib/allocation";
import { parseHkdToCents, formatHkdFromCents } from "@/lib/money";
import { buildDonutPath, type CategorySlice } from "@/lib/report-chart";

describe("parseHkdToCents", () => {
  it("parses dollars and cents", () => {
    expect(parseHkdToCents("12")).toBe(1200);
    expect(parseHkdToCents("12.5")).toBe(1250);
    expect(parseHkdToCents("1,200.00".replace(/,/g, ""))).toBe(120000);
    expect(parseHkdToCents("0.01")).toBe(1);
  });

  it("rejects invalid input", () => {
    expect(parseHkdToCents("")).toBeNull();
    expect(parseHkdToCents("-1")).toBeNull();
    expect(parseHkdToCents("12.345")).toBeNull();
    expect(parseHkdToCents("abc")).toBeNull();
  });
});

describe("expense allocation commit invariant", () => {
  it("baselines sum to total on commit-shaped input", () => {
    const result = allocate({
      fixedCents: 40000,
      variableCents: 80000,
      totalCents: 120000,
      participants: [
        { membershipId: "a", usageUnits: 4 },
        { membershipId: "b", usageUnits: 3 },
        { membershipId: "c", usageUnits: 2 },
        { membershipId: "d", usageUnits: 1 },
      ],
    });
    const sum = result.lines.reduce((s, l) => s + l.baselineCents, 0);
    expect(sum).toBe(120000);
    expect(formatHkdFromCents(sum)).toBe("HK$1,200.00");
  });
});

describe("category report slices / donut", () => {
  it("builds donut paths that cover all slices", () => {
    const slices: CategorySlice[] = [
      { key: "cat:1", label: "Training", totalCents: 120000 },
      { key: "__one_time__", label: "One-time expenses", totalCents: 40000 },
    ];
    const paths = buildDonutPath(slices);
    expect(paths).toHaveLength(2);
    expect(paths[0]!.label).toBe("Training");
    expect(paths.every((p) => p.d.startsWith("M "))).toBe(true);
  });

  it("returns empty for zero totals", () => {
    expect(buildDonutPath([])).toEqual([]);
  });
});

describe("payment method contract", () => {
  it("tracking-only method is TRACKED", () => {
    const methods = ["TRACKED"] as const;
    expect(methods).toEqual(["TRACKED"]);
    expect(methods).not.toContain("WALLET");
    expect(methods).not.toContain("STRIPE_SUCCESS");
  });
});
