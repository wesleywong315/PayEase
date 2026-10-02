import { prisma } from "@/lib/db";
import { getMembershipBalances } from "@/server/services/balances";

export type ChargeLine = {
  expenseId: string;
  title: string;
  category: string;
  dueAt: string | null;
  finalChargeCents: number;
  paidCents: number;
  outstandingCents: number;
};

export type MemberReceivableRow = {
  membershipId: string;
  displayName: string;
  email: string | null;
  role: "COORDINATOR" | "MEMBER";
  contributionOutstandingCents: number;
  reimbursementOutstandingCents: number;
  refundDueCents: number;
  charges: ChargeLine[];
};

/**
 * Coordinator receivables view for one cycle: who still owes contributions,
 * with per-expense charge breakdown.
 */
export async function getCoordinatorReceivables(input: {
  communityId: string;
  cycleId: string;
}): Promise<MemberReceivableRow[]> {
  const members = await prisma.membership.findMany({
    where: { communityId: input.communityId, status: "ACTIVE" },
    include: { user: { select: { displayName: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });

  if (members.length === 0) return [];

  const membershipIds = members.map((m) => m.id);
  const balances = await getMembershipBalances(membershipIds);

  const allocations = await prisma.allocation.findMany({
    where: {
      membershipId: { in: membershipIds },
      expense: {
        communityId: input.communityId,
        cycleId: input.cycleId,
        status: "COMMITTED",
      },
    },
    include: {
      expense: {
        select: {
          id: true,
          title: true,
          category: true,
          dueAt: true,
        },
      },
    },
    orderBy: [{ expense: { dueAt: "asc" } }, { expenseId: "asc" }],
  });

  const cash = await prisma.cashTransaction.findMany({
    where: {
      cycleId: input.cycleId,
      membershipId: { in: membershipIds },
      type: "MEMBER_CONTRIBUTION",
      expenseId: { not: null },
    },
    select: { membershipId: true, expenseId: true, amountCents: true },
  });

  const paidByKey = new Map<string, number>();
  for (const tx of cash) {
    if (!tx.membershipId || !tx.expenseId) continue;
    const key = `${tx.membershipId}:${tx.expenseId}`;
    paidByKey.set(key, (paidByKey.get(key) ?? 0) + tx.amountCents);
  }

  const chargesByMember = new Map<string, ChargeLine[]>();
  for (const row of allocations) {
    const paid = paidByKey.get(`${row.membershipId}:${row.expenseId}`) ?? 0;
    const outstandingCents = Math.max(0, row.finalChargeCents - paid);
    const list = chargesByMember.get(row.membershipId) ?? [];
    list.push({
      expenseId: row.expense.id,
      title: row.expense.title,
      category: row.expense.category,
      dueAt: row.expense.dueAt?.toISOString() ?? null,
      finalChargeCents: row.finalChargeCents,
      paidCents: paid,
      outstandingCents,
    });
    chargesByMember.set(row.membershipId, list);
  }

  return members.map((m) => {
    const balance = balances.get(m.id);
    return {
      membershipId: m.id,
      displayName: m.user.displayName,
      email: m.user.email,
      role: m.role,
      contributionOutstandingCents:
        balance?.contributionOutstandingCents ?? 0,
      reimbursementOutstandingCents:
        balance?.reimbursementOutstandingCents ?? 0,
      refundDueCents: balance?.refundDueCents ?? 0,
      charges: chargesByMember.get(m.id) ?? [],
    };
  });
}
