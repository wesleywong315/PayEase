import { prisma } from "@/lib/db";

export type MemberBalanceBreakdown = {
  membershipId: string;
  communityId: string;
  contributionOutstandingCents: number;
  refundDueCents: number;
  reimbursementOutstandingCents: number;
};

/**
 * Per-membership balances. Does not net contribution vs reimbursement.
 */
export async function getMembershipBalances(
  membershipIds: string[],
): Promise<Map<string, MemberBalanceBreakdown>> {
  const result = new Map<string, MemberBalanceBreakdown>();
  if (membershipIds.length === 0) return result;

  const memberships = await prisma.membership.findMany({
    where: { id: { in: membershipIds } },
    select: { id: true, communityId: true },
  });

  for (const m of memberships) {
    result.set(m.id, {
      membershipId: m.id,
      communityId: m.communityId,
      contributionOutstandingCents: 0,
      refundDueCents: 0,
      reimbursementOutstandingCents: 0,
    });
  }

  const allocations = await prisma.allocation.findMany({
    where: {
      membershipId: { in: membershipIds },
      expense: { status: "COMMITTED" },
    },
    select: {
      membershipId: true,
      finalChargeCents: true,
    },
  });

  const charges = new Map<string, number>();
  for (const row of allocations) {
    charges.set(
      row.membershipId,
      (charges.get(row.membershipId) ?? 0) + row.finalChargeCents,
    );
  }

  const cash = await prisma.cashTransaction.findMany({
    where: {
      membershipId: { in: membershipIds },
      type: {
        in: ["MEMBER_CONTRIBUTION", "MEMBER_REFUND", "PAYER_REIMBURSEMENT"],
      },
    },
    select: {
      membershipId: true,
      type: true,
      amountCents: true,
    },
  });

  const contributions = new Map<string, number>();
  const refunds = new Map<string, number>();
  const reimbursementsPaid = new Map<string, number>();

  for (const tx of cash) {
    if (!tx.membershipId) continue;
    if (tx.type === "MEMBER_CONTRIBUTION") {
      contributions.set(
        tx.membershipId,
        (contributions.get(tx.membershipId) ?? 0) + tx.amountCents,
      );
    } else if (tx.type === "MEMBER_REFUND") {
      refunds.set(
        tx.membershipId,
        (refunds.get(tx.membershipId) ?? 0) + tx.amountCents,
      );
    } else if (tx.type === "PAYER_REIMBURSEMENT") {
      reimbursementsPaid.set(
        tx.membershipId,
        (reimbursementsPaid.get(tx.membershipId) ?? 0) + tx.amountCents,
      );
    }
  }

  const fronted = await prisma.expense.findMany({
    where: {
      status: "COMMITTED",
      frontedByMembershipId: { in: membershipIds },
    },
    select: {
      frontedByMembershipId: true,
      totalCents: true,
    },
  });

  const frontedTotals = new Map<string, number>();
  for (const expense of fronted) {
    if (!expense.frontedByMembershipId) continue;
    frontedTotals.set(
      expense.frontedByMembershipId,
      (frontedTotals.get(expense.frontedByMembershipId) ?? 0) +
        expense.totalCents,
    );
  }

  for (const [membershipId, row] of result) {
    const balance =
      (charges.get(membershipId) ?? 0) -
      (contributions.get(membershipId) ?? 0) +
      (refunds.get(membershipId) ?? 0);

    row.contributionOutstandingCents = Math.max(0, balance);
    row.refundDueCents = Math.max(0, -balance);
    row.reimbursementOutstandingCents = Math.max(
      0,
      (frontedTotals.get(membershipId) ?? 0) -
        (reimbursementsPaid.get(membershipId) ?? 0),
    );
  }

  return result;
}
