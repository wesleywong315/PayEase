import { assertSafeNonNegativeInt } from "@/lib/money";
import type { AllocationInput, ValidatedAllocationInput } from "./types";

export class AllocationInputError extends Error {
  readonly code = "ALLOCATION_INPUT_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "AllocationInputError";
  }
}

/**
 * Validate expense allocation inputs. Rejects unsafe/negative money, total mismatch,
 * empty participants, duplicate membershipIds, and invalid usage units.
 */
export function validateExpenseInputs(
  input: AllocationInput,
): ValidatedAllocationInput {
  const { fixedCents, variableCents, totalCents, participants } = input;

  try {
    assertSafeNonNegativeInt(fixedCents);
    assertSafeNonNegativeInt(variableCents);
    assertSafeNonNegativeInt(totalCents);
  } catch {
    throw new AllocationInputError(
      "fixedCents, variableCents, and totalCents must be safe nonnegative integers",
    );
  }

  const sum = fixedCents + variableCents;
  if (!Number.isSafeInteger(sum)) {
    throw new AllocationInputError(
      "fixedCents + variableCents overflows safe integer range",
    );
  }
  if (sum <= 0) {
    throw new AllocationInputError("totalCents must be greater than 0");
  }
  if (totalCents !== sum) {
    throw new AllocationInputError(
      `totalCents (${totalCents}) must equal fixedCents + variableCents (${sum})`,
    );
  }

  if (!Array.isArray(participants) || participants.length === 0) {
    throw new AllocationInputError("participants must be a non-empty array");
  }

  const seen = new Set<string>();
  const validatedParticipants: Array<{
    membershipId: string;
    usageUnits: number;
  }> = [];

  for (const p of participants) {
    if (typeof p?.membershipId !== "string" || p.membershipId.length === 0) {
      throw new AllocationInputError(
        "each participant must have a non-empty membershipId string",
      );
    }
    if (seen.has(p.membershipId)) {
      throw new AllocationInputError(
        `duplicate membershipId: ${p.membershipId}`,
      );
    }
    seen.add(p.membershipId);

    try {
      assertSafeNonNegativeInt(p.usageUnits);
    } catch {
      throw new AllocationInputError(
        `usageUnits for ${p.membershipId} must be a safe nonnegative integer`,
      );
    }

    validatedParticipants.push({
      membershipId: p.membershipId,
      usageUnits: p.usageUnits,
    });
  }

  return {
    fixedCents,
    variableCents,
    totalCents,
    participants: validatedParticipants,
  };
}
