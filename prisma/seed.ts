/**
 * Idempotent demo seed for PayEase §10.
 * Stable IDs keep rounding tie-breaks reproducible across re-seeds.
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  CapRequestStatus,
  CashTxType,
  CycleStatus,
  ExpenseStatus,
  HardshipFundingKind,
  MembershipRole,
  MembershipStatus,
  PrismaClient,
  RuleStatus,
} from "../src/generated/prisma/client";
import { resolveSqliteUrl } from "../src/lib/db";
import { getDatabaseUrl } from "../src/lib/env";
import { DEMO, EXTRA_DEMO_COMMUNITIES } from "./demo-ids";

const RULE_BODY = `PayEase demo rule v1 for Autumn 2026.

- Shared (fixed) costs are split equally among responsible participants.
- Usage-linked costs are split by nonnegative usage units for that expense.
- If usage totals zero while a variable cost remains, use equal-share fallback and show a warning.
- Hardship support uses a funded pool only; other members' bills are not increased automatically.
- Leaving retains committed obligations and releases uncommitted draft participation.
`;

async function main() {
  const adapter = new PrismaBetterSqlite3({
    url: resolveSqliteUrl(getDatabaseUrl()),
  });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.community.upsert({
        where: { id: DEMO.communityId },
        update: { name: DEMO.communityName },
        create: {
          id: DEMO.communityId,
          name: DEMO.communityName,
        },
      });

      for (const user of Object.values(DEMO.users)) {
        await tx.user.upsert({
          where: { id: user.id },
          update: { displayName: user.displayName, email: user.email },
          create: {
            id: user.id,
            displayName: user.displayName,
            email: user.email,
          },
        });
      }

      const membershipDefs = [
        {
          id: DEMO.memberships.alex,
          userId: DEMO.users.alex.id,
          role: MembershipRole.COORDINATOR,
        },
        {
          id: DEMO.memberships.ben,
          userId: DEMO.users.ben.id,
          role: MembershipRole.MEMBER,
        },
        {
          id: DEMO.memberships.chloe,
          userId: DEMO.users.chloe.id,
          role: MembershipRole.MEMBER,
        },
        {
          id: DEMO.memberships.dana,
          userId: DEMO.users.dana.id,
          role: MembershipRole.MEMBER,
        },
      ] as const;

      for (const m of membershipDefs) {
        await tx.membership.upsert({
          where: { id: m.id },
          update: {
            communityId: DEMO.communityId,
            userId: m.userId,
            role: m.role,
            status: MembershipStatus.ACTIVE,
            leftAt: null,
          },
          create: {
            id: m.id,
            communityId: DEMO.communityId,
            userId: m.userId,
            role: m.role,
            status: MembershipStatus.ACTIVE,
          },
        });
      }

      await tx.financialCycle.upsert({
        where: { id: DEMO.cycleId },
        update: {
          communityId: DEMO.communityId,
          name: DEMO.cycleName,
          status: CycleStatus.OPEN,
          closedAt: null,
          closeAcknowledgedOutstanding: false,
        },
        create: {
          id: DEMO.cycleId,
          communityId: DEMO.communityId,
          name: DEMO.cycleName,
          status: CycleStatus.OPEN,
          revision: 1,
        },
      });

      const acceptorIds = [
        DEMO.memberships.alex,
        DEMO.memberships.ben,
        DEMO.memberships.chloe,
        DEMO.memberships.dana,
      ];

      const proposedAt = new Date("2026-09-01T00:00:00.000Z");
      const acceptedAt = new Date("2026-09-02T00:00:00.000Z");

      await tx.ruleVersion.upsert({
        where: { id: DEMO.ruleId },
        update: {
          communityId: DEMO.communityId,
          cycleId: DEMO.cycleId,
          versionNumber: 1,
          status: RuleStatus.ACCEPTED,
          title: "Autumn 2026 shared spending rule",
          bodyMarkdown: RULE_BODY,
          equalShareFallbackWhenZeroUsage: true,
          requiredAcceptorIdsJson: JSON.stringify(acceptorIds),
          createdByMembershipId: DEMO.memberships.alex,
          proposedAt,
          acceptedAt,
        },
        create: {
          id: DEMO.ruleId,
          communityId: DEMO.communityId,
          cycleId: DEMO.cycleId,
          versionNumber: 1,
          status: RuleStatus.ACCEPTED,
          title: "Autumn 2026 shared spending rule",
          bodyMarkdown: RULE_BODY,
          equalShareFallbackWhenZeroUsage: true,
          requiredAcceptorIdsJson: JSON.stringify(acceptorIds),
          createdByMembershipId: DEMO.memberships.alex,
          proposedAt,
          acceptedAt,
        },
      });

      for (const membershipId of acceptorIds) {
        const acceptanceId = `ra_${membershipId}`;
        await tx.ruleAcceptance.upsert({
          where: { id: acceptanceId },
          update: {
            ruleVersionId: DEMO.ruleId,
            membershipId,
            acceptedAt,
          },
          create: {
            id: acceptanceId,
            ruleVersionId: DEMO.ruleId,
            membershipId,
            acceptedAt,
          },
        });
      }

      const committedAt = new Date("2026-09-10T00:00:00.000Z");

      await tx.expense.upsert({
        where: { id: DEMO.trainingExpenseId },
        update: {
          communityId: DEMO.communityId,
          cycleId: DEMO.cycleId,
          ruleVersionId: DEMO.ruleId,
          status: ExpenseStatus.COMMITTED,
          title: "Season training package",
          category: "Training",
          fixedCents: DEMO.trainingFixedCents,
          variableCents: DEMO.trainingVariableCents,
          totalCents: DEMO.trainingTotalCents,
          usageLabel: "Sessions attended",
          frontedByMembershipId: DEMO.memberships.alex,
          needsRevision: false,
          committedAt,
          cancelledAt: null,
          createdByMembershipId: DEMO.memberships.alex,
        },
        create: {
          id: DEMO.trainingExpenseId,
          communityId: DEMO.communityId,
          cycleId: DEMO.cycleId,
          ruleVersionId: DEMO.ruleId,
          status: ExpenseStatus.COMMITTED,
          title: "Season training package",
          category: "Training",
          fixedCents: DEMO.trainingFixedCents,
          variableCents: DEMO.trainingVariableCents,
          totalCents: DEMO.trainingTotalCents,
          usageLabel: "Sessions attended",
          frontedByMembershipId: DEMO.memberships.alex,
          needsRevision: false,
          committedAt,
          createdByMembershipId: DEMO.memberships.alex,
        },
      });

      const trainingParticipants = [
        { id: "ep_training_alex", membershipId: DEMO.memberships.alex, usageUnits: 4 },
        { id: "ep_training_ben", membershipId: DEMO.memberships.ben, usageUnits: 3 },
        { id: "ep_training_chloe", membershipId: DEMO.memberships.chloe, usageUnits: 2 },
        { id: "ep_training_dana", membershipId: DEMO.memberships.dana, usageUnits: 1 },
      ] as const;

      for (const p of trainingParticipants) {
        await tx.expenseParticipant.upsert({
          where: { id: p.id },
          update: {
            expenseId: DEMO.trainingExpenseId,
            membershipId: p.membershipId,
            usageUnits: p.usageUnits,
          },
          create: {
            id: p.id,
            expenseId: DEMO.trainingExpenseId,
            membershipId: p.membershipId,
            usageUnits: p.usageUnits,
          },
        });
      }

      const allocationDefs = [
        {
          id: "alloc_training_alex",
          membershipId: DEMO.memberships.alex,
          fixedShareCents: 10000,
          usageShareCents: 32000,
          baselineCents: DEMO.trainingBaselinesCents.mem_alex,
        },
        {
          id: "alloc_training_ben",
          membershipId: DEMO.memberships.ben,
          fixedShareCents: 10000,
          usageShareCents: 24000,
          baselineCents: DEMO.trainingBaselinesCents.mem_ben,
        },
        {
          id: "alloc_training_chloe",
          membershipId: DEMO.memberships.chloe,
          fixedShareCents: 10000,
          usageShareCents: 16000,
          baselineCents: DEMO.trainingBaselinesCents.mem_chloe,
        },
        {
          id: "alloc_training_dana",
          membershipId: DEMO.memberships.dana,
          fixedShareCents: 10000,
          usageShareCents: 8000,
          baselineCents: DEMO.trainingBaselinesCents.mem_dana,
        },
      ] as const;

      for (const a of allocationDefs) {
        await tx.allocation.upsert({
          where: { id: a.id },
          update: {
            expenseId: DEMO.trainingExpenseId,
            membershipId: a.membershipId,
            fixedShareCents: a.fixedShareCents,
            usageShareCents: a.usageShareCents,
            baselineCents: a.baselineCents,
            hardshipAppliedCents: 0,
            finalChargeCents: a.baselineCents,
          },
          create: {
            id: a.id,
            expenseId: DEMO.trainingExpenseId,
            membershipId: a.membershipId,
            fixedShareCents: a.fixedShareCents,
            usageShareCents: a.usageShareCents,
            baselineCents: a.baselineCents,
            hardshipAppliedCents: 0,
            finalChargeCents: a.baselineCents,
          },
        });
      }

      await tx.expense.upsert({
        where: { id: DEMO.transportExpenseId },
        update: {
          communityId: DEMO.communityId,
          cycleId: DEMO.cycleId,
          ruleVersionId: DEMO.ruleId,
          status: ExpenseStatus.DRAFT,
          title: "Upcoming friendly-match transport",
          category: "Transport",
          fixedCents: DEMO.transportFixedCents,
          variableCents: 0,
          totalCents: DEMO.transportFixedCents,
          usageLabel: "Seats reserved",
          frontedByMembershipId: null,
          needsRevision: false,
          committedAt: null,
          cancelledAt: null,
          createdByMembershipId: DEMO.memberships.alex,
        },
        create: {
          id: DEMO.transportExpenseId,
          communityId: DEMO.communityId,
          cycleId: DEMO.cycleId,
          ruleVersionId: DEMO.ruleId,
          status: ExpenseStatus.DRAFT,
          title: "Upcoming friendly-match transport",
          category: "Transport",
          fixedCents: DEMO.transportFixedCents,
          variableCents: 0,
          totalCents: DEMO.transportFixedCents,
          usageLabel: "Seats reserved",
          createdByMembershipId: DEMO.memberships.alex,
        },
      });

      const transportParticipants = [
        { id: "ep_transport_alex", membershipId: DEMO.memberships.alex, usageUnits: 1 },
        { id: "ep_transport_ben", membershipId: DEMO.memberships.ben, usageUnits: 1 },
        { id: "ep_transport_chloe", membershipId: DEMO.memberships.chloe, usageUnits: 1 },
        { id: "ep_transport_dana", membershipId: DEMO.memberships.dana, usageUnits: 1 },
      ] as const;

      for (const p of transportParticipants) {
        await tx.expenseParticipant.upsert({
          where: { id: p.id },
          update: {
            expenseId: DEMO.transportExpenseId,
            membershipId: p.membershipId,
            usageUnits: p.usageUnits,
          },
          create: {
            id: p.id,
            expenseId: DEMO.transportExpenseId,
            membershipId: p.membershipId,
            usageUnits: p.usageUnits,
          },
        });
      }

      await tx.cashTransaction.upsert({
        where: { id: DEMO.cashHardshipId },
        update: {
          cycleId: DEMO.cycleId,
          type: CashTxType.HARDSHIP_FUNDING_RECEIPT,
          amountCents: DEMO.hardshipReceivedCents,
          membershipId: null,
          expenseId: null,
          idempotencyKey: "demo-hardship-funding-received-80",
          note: "Demo hardship pool receipt",
          manuallyConfirmed: true,
          recordedByMembershipId: DEMO.memberships.alex,
        },
        create: {
          id: DEMO.cashHardshipId,
          cycleId: DEMO.cycleId,
          type: CashTxType.HARDSHIP_FUNDING_RECEIPT,
          amountCents: DEMO.hardshipReceivedCents,
          idempotencyKey: "demo-hardship-funding-received-80",
          note: "Demo hardship pool receipt",
          manuallyConfirmed: true,
          recordedByMembershipId: DEMO.memberships.alex,
        },
      });

      await tx.hardshipFunding.upsert({
        where: { id: DEMO.fundingId },
        update: {
          cycleId: DEMO.cycleId,
          kind: HardshipFundingKind.RECEIVED,
          amountCents: DEMO.hardshipReceivedCents,
          note: "Demo received hardship funding",
          recordedByMembershipId: DEMO.memberships.alex,
          cashTransactionId: DEMO.cashHardshipId,
        },
        create: {
          id: DEMO.fundingId,
          cycleId: DEMO.cycleId,
          kind: HardshipFundingKind.RECEIVED,
          amountCents: DEMO.hardshipReceivedCents,
          note: "Demo received hardship funding",
          recordedByMembershipId: DEMO.memberships.alex,
          cashTransactionId: DEMO.cashHardshipId,
        },
      });

      await tx.contributionCapRequest.upsert({
        where: { id: DEMO.capRequestId },
        update: {
          cycleId: DEMO.cycleId,
          membershipId: DEMO.memberships.dana,
          requestedCapCents: DEMO.danaCapCents,
          explanation:
            "Self-declared contribution cap for Autumn 2026 demo (not verified income).",
          status: CapRequestStatus.PENDING,
          decidedByMembershipId: null,
          decidedAt: null,
          rejectionReason: null,
        },
        create: {
          id: DEMO.capRequestId,
          cycleId: DEMO.cycleId,
          membershipId: DEMO.memberships.dana,
          requestedCapCents: DEMO.danaCapCents,
          explanation:
            "Self-declared contribution cap for Autumn 2026 demo (not verified income).",
          status: CapRequestStatus.PENDING,
        },
      });

      await tx.hardshipAward.deleteMany({
        where: { capRequestId: DEMO.capRequestId },
      });

      await tx.auditEvent.upsert({
        where: { id: DEMO.auditSeedId },
        update: {
          communityId: DEMO.communityId,
          cycleId: DEMO.cycleId,
          actorMembershipId: DEMO.memberships.alex,
          action: "DEMO_SEEDED",
          entityType: "FinancialCycle",
          entityId: DEMO.cycleId,
          payloadJson: JSON.stringify({
            communityId: DEMO.communityId,
            trainingExpenseId: DEMO.trainingExpenseId,
            transportExpenseId: DEMO.transportExpenseId,
            capRequestStatus: CapRequestStatus.PENDING,
          }),
        },
        create: {
          id: DEMO.auditSeedId,
          communityId: DEMO.communityId,
          cycleId: DEMO.cycleId,
          actorMembershipId: DEMO.memberships.alex,
          action: "DEMO_SEEDED",
          entityType: "FinancialCycle",
          entityId: DEMO.cycleId,
          payloadJson: JSON.stringify({
            communityId: DEMO.communityId,
            trainingExpenseId: DEMO.trainingExpenseId,
            transportExpenseId: DEMO.transportExpenseId,
            capRequestStatus: CapRequestStatus.PENDING,
          }),
        },
      });

      // Extra communities for personal inbox multi-membership demos.
      const vb = EXTRA_DEMO_COMMUNITIES.volleyball;
      await tx.community.upsert({
        where: { id: vb.id },
        update: { name: vb.name },
        create: { id: vb.id, name: vb.name },
      });
      await tx.financialCycle.upsert({
        where: { id: vb.cycleId },
        update: {
          communityId: vb.id,
          name: vb.cycleName,
          status: CycleStatus.OPEN,
        },
        create: {
          id: vb.cycleId,
          communityId: vb.id,
          name: vb.cycleName,
          status: CycleStatus.OPEN,
          revision: 1,
        },
      });
      await tx.membership.upsert({
        where: { id: vb.memberships.ben },
        update: {
          communityId: vb.id,
          userId: DEMO.users.ben.id,
          role: MembershipRole.COORDINATOR,
          status: MembershipStatus.ACTIVE,
          leftAt: null,
        },
        create: {
          id: vb.memberships.ben,
          communityId: vb.id,
          userId: DEMO.users.ben.id,
          role: MembershipRole.COORDINATOR,
          status: MembershipStatus.ACTIVE,
        },
      });
      await tx.membership.upsert({
        where: { id: vb.memberships.alex },
        update: {
          communityId: vb.id,
          userId: DEMO.users.alex.id,
          role: MembershipRole.MEMBER,
          status: MembershipStatus.ACTIVE,
          leftAt: null,
        },
        create: {
          id: vb.memberships.alex,
          communityId: vb.id,
          userId: DEMO.users.alex.id,
          role: MembershipRole.MEMBER,
          status: MembershipStatus.ACTIVE,
        },
      });

      const swim = EXTRA_DEMO_COMMUNITIES.swimming;
      await tx.community.upsert({
        where: { id: swim.id },
        update: { name: swim.name },
        create: { id: swim.id, name: swim.name },
      });
      await tx.financialCycle.upsert({
        where: { id: swim.cycleId },
        update: {
          communityId: swim.id,
          name: swim.cycleName,
          status: CycleStatus.OPEN,
        },
        create: {
          id: swim.cycleId,
          communityId: swim.id,
          name: swim.cycleName,
          status: CycleStatus.OPEN,
          revision: 1,
        },
      });
      await tx.membership.upsert({
        where: { id: swim.memberships.chloe },
        update: {
          communityId: swim.id,
          userId: DEMO.users.chloe.id,
          role: MembershipRole.COORDINATOR,
          status: MembershipStatus.ACTIVE,
          leftAt: null,
        },
        create: {
          id: swim.memberships.chloe,
          communityId: swim.id,
          userId: DEMO.users.chloe.id,
          role: MembershipRole.COORDINATOR,
          status: MembershipStatus.ACTIVE,
        },
      });
      await tx.membership.upsert({
        where: { id: swim.memberships.alex },
        update: {
          communityId: swim.id,
          userId: DEMO.users.alex.id,
          role: MembershipRole.MEMBER,
          status: MembershipStatus.ACTIVE,
          leftAt: null,
        },
        create: {
          id: swim.memberships.alex,
          communityId: swim.id,
          userId: DEMO.users.alex.id,
          role: MembershipRole.MEMBER,
          status: MembershipStatus.ACTIVE,
        },
      });
    });

    console.log(
      `Seeded PayEase demo: ${DEMO.communityName} / ${DEMO.cycleName} (cap PENDING) + extra communities`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
