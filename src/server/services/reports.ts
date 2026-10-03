import { prisma } from "@/lib/db";
import type { CategorySlice } from "@/lib/report-chart";
import { getMembershipBalances } from "@/server/services/balances";
import { getTreasurerCashCents } from "@/server/services/ledger";

export type { CategorySlice };

export type SettlementMemberRow = {
  membershipId: string;
  displayName: string;
  baselineCents: number;
  hardshipAppliedCents: number;
  equalCoverAppliedCents: number;
  finalChargeCents: number;
  contributionOutstandingCents: number;
  reimbursementOutstandingCents: number;
};

export async function getSettlementRows(input: {
  communityId: string;
  cycleId: string;
  viewerMembershipId: string;
  isCoordinator: boolean;
}): Promise<{
  treasurerCashCents: number;
  rows: SettlementMemberRow[];
}> {
  const members = await prisma.membership.findMany({
    where: { communityId: input.communityId, status: { in: ["ACTIVE", "LEFT"] } },
    include: { user: { select: { displayName: true } } },
    orderBy: { joinedAt: "asc" },
  });
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
    select: {
      membershipId: true,
      baselineCents: true,
      hardshipAppliedCents: true,
      equalCoverAppliedCents: true,
      finalChargeCents: true,
    },
  });
  const byMember = new Map<
    string,
    { baselineCents: number; hardshipAppliedCents: number; equalCoverAppliedCents: number; finalChargeCents: number }
  >();
  for (const row of allocations) {
    const existing = byMember.get(row.membershipId) ?? {
      baselineCents: 0,
      hardshipAppliedCents: 0,
      equalCoverAppliedCents: 0,
      finalChargeCents: 0,
    };
    existing.baselineCents += row.baselineCents;
    existing.hardshipAppliedCents += row.hardshipAppliedCents;
    existing.equalCoverAppliedCents += row.equalCoverAppliedCents;
    existing.finalChargeCents += row.finalChargeCents;
    byMember.set(row.membershipId, existing);
  }

  let rows: SettlementMemberRow[] = members.map((m) => {
    const alloc = byMember.get(m.id);
    const bal = balances.get(m.id);
    return {
      membershipId: m.id,
      displayName: m.user.displayName,
      baselineCents: alloc?.baselineCents ?? 0,
      hardshipAppliedCents: alloc?.hardshipAppliedCents ?? 0,
      equalCoverAppliedCents: alloc?.equalCoverAppliedCents ?? 0,
      finalChargeCents: alloc?.finalChargeCents ?? 0,
      contributionOutstandingCents: bal?.contributionOutstandingCents ?? 0,
      reimbursementOutstandingCents: bal?.reimbursementOutstandingCents ?? 0,
    };
  });

  if (!input.isCoordinator) {
    rows = rows.filter((r) => r.membershipId === input.viewerMembershipId);
  }

  return {
    treasurerCashCents: await getTreasurerCashCents(input.cycleId),
    rows,
  };
}

export function escapeCsvCell(value: string): string {
  let cell = value;
  if (/^[=+\-@]/.test(cell)) cell = `'${cell}`;
  if (/[",\n]/.test(cell)) cell = `"${cell.replaceAll('"', '""')}"`;
  return cell;
}

export function settlementRowsToCsv(
  rows: SettlementMemberRow[],
  treasurerCashCents: number,
): string {
  const header = [
    "Member",
    "Baseline_cents",
    "PayAid_applied_cents",
    "Equal_cover_applied_cents",
    "Final_charge_cents",
    "Contribution_outstanding_cents",
    "Reimbursement_outstanding_cents",
    "Treasurer_cash_cents",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvCell(row.displayName),
        String(row.baselineCents),
        String(row.hardshipAppliedCents),
        String(row.equalCoverAppliedCents),
        String(row.finalChargeCents),
        String(row.contributionOutstandingCents),
        String(row.reimbursementOutstandingCents),
        String(treasurerCashCents),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

/**
 * Committed expense totals by category. One-time labels roll into a single slice.
 */
export async function getCategoryReportSlices(input: {
  communityId: string;
  cycleId: string;
}): Promise<CategorySlice[]> {
  const expenses = await prisma.expense.findMany({
    where: {
      communityId: input.communityId,
      cycleId: input.cycleId,
      status: "COMMITTED",
    },
    select: {
      category: true,
      categoryId: true,
      isOneTimeCategory: true,
      totalCents: true,
    },
  });

  const map = new Map<string, CategorySlice>();
  for (const e of expenses) {
    const key = e.isOneTimeCategory
      ? "__one_time__"
      : e.categoryId
        ? `cat:${e.categoryId}`
        : `label:${e.category}`;
    const label = e.isOneTimeCategory ? "One-time expenses" : e.category;
    const existing = map.get(key) ?? { key, label, totalCents: 0 };
    existing.totalCents += e.totalCents;
    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.totalCents - a.totalCents);
}
