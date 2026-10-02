import { largestRemainder } from "./largestRemainder";
import type {
  AllocationInput,
  AllocationLine,
  AllocationResult,
  AllocationWarningCode,
} from "./types";
import { validateExpenseInputs } from "./validateExpenseInputs";

export type { AllocationInput, AllocationResult };

/**
 * Pure allocation engine: fixed equal-share + usage-proportional variable,
 * each rounded with Hamilton largest-remainder. No I/O.
 */
export function allocate(input: AllocationInput): AllocationResult {
  const validated = validateExpenseInputs(input);
  const { fixedCents, variableCents, totalCents, participants } = validated;
  const warnings: AllocationWarningCode[] = [];

  const equalParties = participants.map((p) => ({
    membershipId: p.membershipId,
    weight: 1,
  }));

  const fixedShares = largestRemainder(fixedCents, equalParties);

  let usageShares: Map<string, number>;

  const usageSum = participants.reduce((s, p) => s + p.usageUnits, 0);

  if (variableCents === 0) {
    usageShares = new Map(
      participants.map((p) => [p.membershipId, 0] as const),
    );
  } else if (usageSum === 0) {
    warnings.push("ZERO_USAGE_EQUAL_FALLBACK");
    usageShares = largestRemainder(variableCents, equalParties);
  } else {
    const usageParties = participants.map((p) => ({
      membershipId: p.membershipId,
      weight: p.usageUnits,
    }));
    usageShares = largestRemainder(variableCents, usageParties);
  }

  const lines: AllocationLine[] = participants.map((p) => {
    const fixedShareCents = fixedShares.get(p.membershipId) ?? 0;
    const usageShareCents = usageShares.get(p.membershipId) ?? 0;
    return {
      membershipId: p.membershipId,
      fixedShareCents,
      usageShareCents,
      baselineCents: fixedShareCents + usageShareCents,
    };
  });

  const baselineSum = lines.reduce((s, line) => s + line.baselineCents, 0);
  if (baselineSum !== totalCents) {
    throw new Error(
      `Internal invariant failed: sum(baselines)=${baselineSum} !== totalCents=${totalCents}`,
    );
  }

  return {
    fixedCents,
    variableCents,
    totalCents,
    lines,
    warnings,
  };
}
