import { prisma } from "@/lib/db";
import { getMembershipBalances } from "@/server/services/balances";
import { DomainError } from "@/server/services/communities";
import {
  getTreasurerCashCents,
  requireFeatureEnabled,
  requireOpenCycle,
} from "@/server/services/ledger";

export async function recordPayerReimbursement(input: {
  communityId: string;
  cycleId: string;
  actorMembershipId: string;
  membershipId: string;
  amountCents: number;
  note?: string | null;
  idempotencyKey: string;
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new DomainError("VALIDATION_ERROR", "Amount must be a positive integer (cents).");
  }
  const key = input.idempotencyKey.trim();
  if (key.length < 8) {
    throw new DomainError("VALIDATION_ERROR", "Idempotency key must be at least 8 characters.");
  }

  await requireOpenCycle({ communityId: input.communityId, cycleId: input.cycleId });

  const membership = await prisma.membership.findFirst({
    where: { id: input.membershipId, communityId: input.communityId },
  });
  if (!membership) {
    throw new DomainError("NOT_FOUND", "Membership not found.");
  }

  const balances = await getMembershipBalances([input.membershipId]);
  const outstanding =
    balances.get(input.membershipId)?.reimbursementOutstandingCents ?? 0;
  if (input.amountCents > outstanding) {
    throw new DomainError(
      "EXCEEDS_OUTSTANDING_REIMBURSEMENT",
      "Amount exceeds outstanding reimbursement.",
      { outstandingCents: outstanding },
    );
  }

  const cash = await getTreasurerCashCents(input.cycleId);
  if (input.amountCents > cash) {
    throw new DomainError(
      "INSUFFICIENT_TREASURER_CASH",
      "Treasurer cash is too low for this reimbursement.",
      { treasurerCashCents: cash, requiredCents: input.amountCents },
    );
  }

  try {
    const tx = await prisma.cashTransaction.create({
      data: {
        cycleId: input.cycleId,
        type: "PAYER_REIMBURSEMENT",
        amountCents: input.amountCents,
        membershipId: input.membershipId,
        idempotencyKey: key,
        note: input.note?.trim() || "Payer reimbursement",
        manuallyConfirmed: true,
        recordedByMembershipId: input.actorMembershipId,
      },
    });
    await prisma.financialCycle.update({
      where: { id: input.cycleId },
      data: { revision: { increment: 1 } },
    });
    await prisma.auditEvent.create({
      data: {
        communityId: input.communityId,
        cycleId: input.cycleId,
        actorMembershipId: input.actorMembershipId,
        action: "PAYER_REIMBURSEMENT_RECORDED",
        entityType: "CashTransaction",
        entityId: tx.id,
        payloadJson: JSON.stringify({ amountCents: input.amountCents }),
      },
    });
    return tx;
  } catch {
    throw new DomainError("IDEMPOTENCY_CONFLICT", "This reimbursement was already recorded.");
  }
}

export async function recordCoordinatorContribution(input: {
  communityId: string;
  cycleId: string;
  actorMembershipId: string;
  membershipId: string;
  amountCents: number;
  note?: string | null;
  idempotencyKey: string;
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new DomainError("VALIDATION_ERROR", "Amount must be a positive integer (cents).");
  }
  const key = input.idempotencyKey.trim();
  if (key.length < 8) {
    throw new DomainError("VALIDATION_ERROR", "Idempotency key must be at least 8 characters.");
  }

  await requireOpenCycle({ communityId: input.communityId, cycleId: input.cycleId });
  await requireFeatureEnabled(
    input.cycleId,
    "contributionsEnabled",
    "Contributions are disabled for the accepted rule.",
  );

  const membership = await prisma.membership.findFirst({
    where: { id: input.membershipId, communityId: input.communityId },
  });
  if (!membership) {
    throw new DomainError("NOT_FOUND", "Membership not found.");
  }

  const balances = await getMembershipBalances([input.membershipId]);
  const outstanding =
    balances.get(input.membershipId)?.contributionOutstandingCents ?? 0;
  if (input.amountCents > outstanding) {
    throw new DomainError(
      "EXCEEDS_OUTSTANDING_CONTRIBUTION",
      "Amount exceeds outstanding contribution.",
      { outstandingCents: outstanding },
    );
  }

  try {
    const tx = await prisma.cashTransaction.create({
      data: {
        cycleId: input.cycleId,
        type: "MEMBER_CONTRIBUTION",
        amountCents: input.amountCents,
        membershipId: input.membershipId,
        idempotencyKey: key,
        note: input.note?.trim() || "Coordinator-recorded contribution",
        manuallyConfirmed: true,
        recordedByMembershipId: input.actorMembershipId,
      },
    });
    await prisma.financialCycle.update({
      where: { id: input.cycleId },
      data: { revision: { increment: 1 } },
    });
    return tx;
  } catch {
    throw new DomainError("IDEMPOTENCY_CONFLICT", "This contribution was already recorded.");
  }
}
