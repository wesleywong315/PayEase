export type ParticipantInput = {
  membershipId: string;
  usageUnits: number;
};

export type AllocationInput = {
  fixedCents: number;
  variableCents: number;
  /** Must equal fixedCents + variableCents and be > 0. */
  totalCents: number;
  participants: ParticipantInput[];
};

export type ValidatedAllocationInput = {
  fixedCents: number;
  variableCents: number;
  totalCents: number;
  participants: ReadonlyArray<{
    membershipId: string;
    usageUnits: number;
  }>;
};

export type AllocationWarningCode = "ZERO_USAGE_EQUAL_FALLBACK";

export type AllocationLine = {
  membershipId: string;
  fixedShareCents: number;
  usageShareCents: number;
  baselineCents: number;
};

export type AllocationResult = {
  fixedCents: number;
  variableCents: number;
  totalCents: number;
  lines: AllocationLine[];
  warnings: AllocationWarningCode[];
};

export type WeightedParty = {
  membershipId: string;
  weight: number;
};
