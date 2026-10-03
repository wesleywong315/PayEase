import { prisma } from "@/lib/db";
import { getMembershipBalances } from "@/server/services/balances";

export type ProfileArcMetric = {
  id: "payments" | "reimbursements";
  label: string;
  /** Amount already settled (paid in or received). */
  completedCents: number;
  /** Amount still outstanding. */
  remainingCents: number;
  /** completed + remaining (denominator for the arc). */
  totalCents: number;
  /** 0–100 */
  percent: number;
  color: string;
};

function percentOf(completed: number, total: number): number {
  if (total <= 0) return completed > 0 ? 100 : 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

/**
 * Cross-community personal finance arcs for the profile Report tab.
 */
export async function getProfileFinanceArcs(
  userId: string,
): Promise<ProfileArcMetric[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId, status: "ACTIVE" },
    select: { id: true },
  });
  const membershipIds = memberships.map((m) => m.id);

  if (membershipIds.length === 0) {
    return [
      {
        id: "payments",
        label: "Payments due",
        completedCents: 0,
        remainingCents: 0,
        totalCents: 0,
        percent: 0,
        color: "#1f5a45",
      },
      {
        id: "reimbursements",
        label: "Reimbursements due",
        completedCents: 0,
        remainingCents: 0,
        totalCents: 0,
        percent: 0,
        color: "#3f8068",
      },
    ];
  }

  const balances = await getMembershipBalances(membershipIds);

  const cash = await prisma.cashTransaction.findMany({
    where: {
      membershipId: { in: membershipIds },
      type: {
        in: ["MEMBER_CONTRIBUTION", "PAYER_REIMBURSEMENT"],
      },
    },
    select: { type: true, amountCents: true },
  });

  let contributionsPaid = 0;
  let reimbursementsReceived = 0;
  for (const tx of cash) {
    if (tx.type === "MEMBER_CONTRIBUTION") contributionsPaid += tx.amountCents;
    else if (tx.type === "PAYER_REIMBURSEMENT") {
      reimbursementsReceived += tx.amountCents;
    }
  }

  let paymentsRemaining = 0;
  let reimbursementsRemaining = 0;
  for (const row of balances.values()) {
    paymentsRemaining += row.contributionOutstandingCents;
    reimbursementsRemaining += row.reimbursementOutstandingCents;
  }

  const paymentsTotal = contributionsPaid + paymentsRemaining;
  const reimbursementsTotal = reimbursementsReceived + reimbursementsRemaining;

  return [
    {
      id: "payments",
      label: "Payments due",
      completedCents: contributionsPaid,
      remainingCents: paymentsRemaining,
      totalCents: paymentsTotal,
      percent: percentOf(contributionsPaid, paymentsTotal),
      color: "#1f5a45",
    },
    {
      id: "reimbursements",
      label: "Reimbursements due",
      completedCents: reimbursementsReceived,
      remainingCents: reimbursementsRemaining,
      totalCents: reimbursementsTotal,
      percent: percentOf(reimbursementsReceived, reimbursementsTotal),
      color: "#3f8068",
    },
  ];
}
