import type { WeightedParty } from "./types";

/**
 * Hamilton largest-remainder allocation of total T using nonnegative integer weights.
 * Integer math only — no floating quotas.
 *
 * Caller must not invoke when all weights are 0 (use an equal-share fallback first).
 */
export function largestRemainder(
  totalCents: number,
  parties: ReadonlyArray<WeightedParty>,
): Map<string, number> {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new Error(
      `largestRemainder: totalCents must be a safe nonnegative integer, got ${String(totalCents)}`,
    );
  }
  if (parties.length === 0) {
    throw new Error("largestRemainder: parties must be non-empty");
  }

  const W = parties.reduce((sum, p) => {
    if (!Number.isSafeInteger(p.weight) || p.weight < 0) {
      throw new Error(
        `largestRemainder: weight must be a safe nonnegative integer, got ${String(p.weight)}`,
      );
    }
    return sum + p.weight;
  }, 0);

  if (W === 0) {
    throw new Error(
      "largestRemainder: sum of weights is 0; caller must apply a fallback first",
    );
  }

  const floors = new Map<string, number>();
  const remainders: { membershipId: string; rem: number }[] = [];
  let floorSum = 0;

  for (const { membershipId, weight } of parties) {
    const product = totalCents * weight;
    const floor = Math.floor(product / W);
    const rem = product % W;
    floors.set(membershipId, floor);
    floorSum += floor;
    remainders.push({ membershipId, rem });
  }

  const leftover = totalCents - floorSum;

  remainders.sort((a, b) => {
    if (b.rem !== a.rem) return b.rem - a.rem;
    if (a.membershipId < b.membershipId) return -1;
    if (a.membershipId > b.membershipId) return 1;
    return 0;
  });

  for (let i = 0; i < leftover; i++) {
    const id = remainders[i]!.membershipId;
    floors.set(id, floors.get(id)! + 1);
  }

  return floors;
}
