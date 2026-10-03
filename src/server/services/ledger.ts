import { prisma } from "@/lib/db";
import { parseFeatureToggles, type FeatureToggles } from "@/lib/feature-toggles";
import { DomainError } from "@/server/services/communities";

const CASH_IN = new Set([
  "HARDSHIP_FUNDING_RECEIPT",
  "CREDIT_RECEIPT",
  "MEMBER_CONTRIBUTION",
]);
const CASH_OUT = new Set(["PAYER_REIMBURSEMENT"]);

export async function requireOpenCycle(input: {
  communityId: string;
  cycleId?: string;
}) {
  const cycle = input.cycleId
    ? await prisma.financialCycle.findFirst({
        where: { id: input.cycleId, communityId: input.communityId },
      })
    : await prisma.financialCycle.findFirst({
        where: { communityId: input.communityId, status: "OPEN" },
        orderBy: { createdAt: "desc" },
      });

  if (!cycle) {
    throw new DomainError("NOT_FOUND", "Open cycle not found.");
  }
  if (cycle.status !== "OPEN") {
    throw new DomainError("CYCLE_CLOSED", "This cycle is closed and read-only.");
  }
  return cycle;
}

export async function getTreasurerCashCents(cycleId: string): Promise<number> {
  const txs = await prisma.cashTransaction.findMany({
    where: { cycleId },
    select: { type: true, amountCents: true },
  });
  let total = 0;
  for (const tx of txs) {
    if (CASH_IN.has(tx.type)) total += tx.amountCents;
    else if (CASH_OUT.has(tx.type)) total -= tx.amountCents;
  }
  return total;
}

export async function getAcceptedFeatureToggles(
  cycleId: string,
): Promise<FeatureToggles | null> {
  const rule = await prisma.ruleVersion.findFirst({
    where: { cycleId, status: "ACCEPTED" },
    orderBy: { versionNumber: "desc" },
    select: { featureTogglesJson: true },
  });
  if (!rule) return null;
  return parseFeatureToggles(rule.featureTogglesJson);
}

export async function requireFeatureEnabled(
  cycleId: string,
  flag: keyof FeatureToggles,
  message: string,
) {
  const toggles = await getAcceptedFeatureToggles(cycleId);
  if (!toggles || !toggles[flag]) {
    throw new DomainError("FEATURE_DISABLED", message);
  }
  return toggles;
}
