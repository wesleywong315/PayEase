import { prisma } from "@/lib/db";
import { getMembershipBalances } from "@/server/services/balances";
import { DomainError } from "@/server/services/communities";
import {
  getTreasurerCashCents,
  requireFeatureEnabled,
  requireOpenCycle,
} from "@/server/services/ledger";

export type WithdrawalPreview = {
  membershipId: string;
  displayName: string;
  contributionOutstandingCents: number;
  reimbursementOutstandingCents: number;
  committedFinalChargeCents: number;
  treasurerCashCents: number;
  draftsReleased: Array<{ expenseId: string; title: string }>;
  draftsNeedingRevision: Array<{ expenseId: string; title: string }>;
};

export async function previewWithdrawal(input: {
  communityId: string;
  cycleId: string;
  membershipId: string;
}): Promise<WithdrawalPreview> {
  await requireOpenCycle({ communityId: input.communityId, cycleId: input.cycleId });
  await requireFeatureEnabled(
    input.cycleId,
    "withdrawalsEnabled",
    "Withdrawals are disabled for the accepted rule.",
  );

  const membership = await prisma.membership.findFirst({
    where: { id: input.membershipId, communityId: input.communityId },
    include: { user: { select: { displayName: true } } },
  });
  if (!membership) {
    throw new DomainError("NOT_FOUND", "Membership not found.");
  }
  if (membership.status === "LEFT") {
    throw new DomainError("ALREADY_LEFT", "This member has already left the cycle.");
  }

  const balances = await getMembershipBalances([membership.id]);
  const balance = balances.get(membership.id);
  const committed = await prisma.allocation.aggregate({
    where: {
      membershipId: membership.id,
      expense: { cycleId: input.cycleId, status: "COMMITTED" },
    },
    _sum: { finalChargeCents: true },
  });

  const draftParticipations = await prisma.expenseParticipant.findMany({
    where: {
      membershipId: membership.id,
      expense: {
        communityId: input.communityId,
        cycleId: input.cycleId,
        status: "DRAFT",
      },
    },
    include: {
      expense: {
        select: { id: true, title: true, _count: { select: { participants: true } } },
      },
    },
  });

  const draftsReleased = draftParticipations.map((p) => ({
    expenseId: p.expense.id,
    title: p.expense.title,
  }));
  const draftsNeedingRevision = draftParticipations
    .filter((p) => p.expense._count.participants <= 1)
    .map((p) => ({ expenseId: p.expense.id, title: p.expense.title }));

  return {
    membershipId: membership.id,
    displayName: membership.user.displayName,
    contributionOutstandingCents: balance?.contributionOutstandingCents ?? 0,
    reimbursementOutstandingCents: balance?.reimbursementOutstandingCents ?? 0,
    committedFinalChargeCents: committed._sum.finalChargeCents ?? 0,
    treasurerCashCents: await getTreasurerCashCents(input.cycleId),
    draftsReleased,
    draftsNeedingRevision,
  };
}

export async function executeWithdrawal(input: {
  communityId: string;
  cycleId: string;
  membershipId: string;
  actorMembershipId: string;
  cycleRevision: number;
}) {
  const preview = await previewWithdrawal({
    communityId: input.communityId,
    cycleId: input.cycleId,
    membershipId: input.membershipId,
  });

  return prisma.$transaction(async (tx) => {
    const cycle = await tx.financialCycle.findFirst({
      where: { id: input.cycleId, communityId: input.communityId },
    });
    if (!cycle || cycle.status !== "OPEN") {
      throw new DomainError("CYCLE_CLOSED", "This cycle is closed and read-only.");
    }
    if (cycle.revision !== input.cycleRevision) {
      throw new DomainError(
        "STALE_REVISION",
        "Cycle changed since you loaded this page. Refresh and try again.",
        { currentRevision: cycle.revision },
      );
    }

    const membership = await tx.membership.findFirst({
      where: { id: input.membershipId, communityId: input.communityId },
    });
    if (!membership) {
      throw new DomainError("NOT_FOUND", "Membership not found.");
    }
    if (membership.status === "LEFT") {
      throw new DomainError("ALREADY_LEFT", "This member has already left the cycle.");
    }

    const now = new Date();
    await tx.membership.update({
      where: { id: membership.id },
      data: { status: "LEFT", leftAt: now },
    });

    const draftParts = await tx.expenseParticipant.findMany({
      where: {
        membershipId: membership.id,
        expense: { cycleId: input.cycleId, status: "DRAFT" },
      },
      select: { id: true, expenseId: true },
    });
    await tx.expenseParticipant.deleteMany({
      where: { id: { in: draftParts.map((p) => p.id) } },
    });

    const expenseIds = [...new Set(draftParts.map((p) => p.expenseId))];
    for (const expenseId of expenseIds) {
      const remaining = await tx.expenseParticipant.count({ where: { expenseId } });
      if (remaining === 0) {
        await tx.expense.update({
          where: { id: expenseId },
          data: { needsRevision: true },
        });
      }
    }

    const withdrawal = await tx.withdrawal.create({
      data: {
        cycleId: input.cycleId,
        membershipId: membership.id,
        executedByMembershipId: input.actorMembershipId,
        previewSnapshotJson: JSON.stringify(preview),
      },
    });

    await tx.financialCycle.update({
      where: { id: input.cycleId },
      data: { revision: { increment: 1 } },
    });

    await tx.auditEvent.create({
      data: {
        communityId: input.communityId,
        cycleId: input.cycleId,
        actorMembershipId: input.actorMembershipId,
        action: "WITHDRAWAL_EXECUTED",
        entityType: "Withdrawal",
        entityId: withdrawal.id,
        payloadJson: JSON.stringify({ membershipId: membership.id }),
      },
    });

    return { withdrawal, preview };
  });
}
