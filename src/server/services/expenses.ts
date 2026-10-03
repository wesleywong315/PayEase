import { allocate } from "@/lib/allocation";
import { prisma } from "@/lib/db";
import type { FeatureToggles } from "@/lib/feature-toggles";
import {
  DEFAULT_FEATURE_TOGGLES,
  parseFeatureToggles,
} from "@/lib/feature-toggles";
import { findProjectedCapBreaches } from "@/server/services/payaid";
import { applyPendingEqualCover } from "@/server/services/equal-cover";
import { DomainError } from "@/server/services/communities";

export type { FeatureToggles };
export { DEFAULT_FEATURE_TOGGLES, parseFeatureToggles };

export async function getAcceptedRule(cycleId: string) {
  return prisma.ruleVersion.findFirst({
    where: { cycleId, status: "ACCEPTED" },
    orderBy: { versionNumber: "desc" },
    include: {
      acceptances: {
        include: {
          membership: { include: { user: { select: { displayName: true } } } },
        },
      },
    },
  });
}

/**
 * Coordinator proposes a new rule version. Active members at propose time
 * must each accept before it becomes ACCEPTED.
 */
export async function proposeRuleVersion(input: {
  communityId: string;
  cycleId: string;
  actorMembershipId: string;
  title: string;
  bodyMarkdown: string;
  equalShareFallbackWhenZeroUsage: boolean;
  featureToggles: FeatureToggles;
  cycleBudgetCapCents: number | null;
}) {
  const title = input.title.trim();
  const body = input.bodyMarkdown.trim();
  if (title.length < 2 || title.length > 120) {
    throw new DomainError("VALIDATION_ERROR", "Rule title must be 2–120 characters.");
  }
  if (body.length < 10) {
    throw new DomainError("VALIDATION_ERROR", "Rule body must be at least 10 characters.");
  }
  if (
    input.cycleBudgetCapCents !== null &&
    (!Number.isInteger(input.cycleBudgetCapCents) || input.cycleBudgetCapCents < 0)
  ) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Cycle budget cap must be a non-negative integer (cents) or null.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const cycle = await tx.financialCycle.findFirst({
      where: { id: input.cycleId, communityId: input.communityId },
    });
    if (!cycle) {
      throw new DomainError("NOT_FOUND", "Cycle not found.");
    }
    if (cycle.status !== "OPEN") {
      throw new DomainError("CYCLE_CLOSED", "This cycle is closed and read-only.");
    }

    const pendingProposed = await tx.ruleVersion.findFirst({
      where: { cycleId: input.cycleId, status: "PROPOSED" },
    });
    if (pendingProposed) {
      throw new DomainError(
        "CONFLICT",
        "A proposed rule is already awaiting acceptance. Finish that vote first.",
      );
    }

    const latest = await tx.ruleVersion.findFirst({
      where: { cycleId: input.cycleId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;

    const activeMembers = await tx.membership.findMany({
      where: { communityId: input.communityId, status: "ACTIVE" },
      select: { id: true },
    });
    const acceptorIds = activeMembers.map((m) => m.id);
    if (acceptorIds.length === 0) {
      throw new DomainError("PRECONDITION_FAILED", "No active members to accept this rule.");
    }
    const now = new Date();

    const rule = await tx.ruleVersion.create({
      data: {
        communityId: input.communityId,
        cycleId: input.cycleId,
        versionNumber,
        status: "PROPOSED",
        title,
        bodyMarkdown: body,
        equalShareFallbackWhenZeroUsage: input.equalShareFallbackWhenZeroUsage,
        featureTogglesJson: JSON.stringify(input.featureToggles),
        cycleBudgetCapCents: input.cycleBudgetCapCents,
        requiredAcceptorIdsJson: JSON.stringify(acceptorIds),
        createdByMembershipId: input.actorMembershipId,
        proposedAt: now,
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
        action: "RULE_VERSION_PROPOSED",
        entityType: "RuleVersion",
        entityId: rule.id,
        payloadJson: JSON.stringify({
          versionNumber,
          requiredAcceptorIds: acceptorIds,
          cycleBudgetCapCents: input.cycleBudgetCapCents,
          featureToggles: input.featureToggles,
        }),
      },
    });

    return rule;
  });
}

export async function acceptProposedRule(input: {
  communityId: string;
  ruleId: string;
  membershipId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const rule = await tx.ruleVersion.findFirst({
      where: { id: input.ruleId, communityId: input.communityId },
      include: { acceptances: true, cycle: true },
    });
    if (!rule) {
      throw new DomainError("NOT_FOUND", "Rule not found.");
    }
    if (rule.cycle.status !== "OPEN") {
      throw new DomainError("CYCLE_CLOSED", "This cycle is closed and read-only.");
    }
    if (rule.status !== "PROPOSED") {
      throw new DomainError("RULE_NOT_PROPOSED", "Only a proposed rule can be accepted.");
    }

    let required: string[] = [];
    try {
      required = JSON.parse(rule.requiredAcceptorIdsJson) as string[];
    } catch {
      required = [];
    }
    if (!required.includes(input.membershipId)) {
      throw new DomainError(
        "FORBIDDEN",
        "You are not on the snapshot of members required to accept this version.",
      );
    }

    const already = rule.acceptances.some((a) => a.membershipId === input.membershipId);
    if (already) {
      throw new DomainError("ALREADY_ACCEPTED", "You have already accepted this rule.");
    }

    const now = new Date();
    await tx.ruleAcceptance.create({
      data: {
        ruleVersionId: rule.id,
        membershipId: input.membershipId,
        acceptedAt: now,
      },
    });

    const acceptedIds = new Set([
      ...rule.acceptances.map((a) => a.membershipId),
      input.membershipId,
    ]);
    const complete = required.every((id) => acceptedIds.has(id));

    const updated = complete
      ? await tx.ruleVersion.update({
          where: { id: rule.id },
          data: { status: "ACCEPTED", acceptedAt: now },
        })
      : await tx.ruleVersion.findUniqueOrThrow({ where: { id: rule.id } });

    await tx.financialCycle.update({
      where: { id: rule.cycleId },
      data: { revision: { increment: 1 } },
    });

    await tx.auditEvent.create({
      data: {
        communityId: input.communityId,
        cycleId: rule.cycleId,
        actorMembershipId: input.membershipId,
        action: complete ? "RULE_VERSION_ACCEPTED" : "RULE_ACCEPTANCE_RECORDED",
        entityType: "RuleVersion",
        entityId: rule.id,
        payloadJson: JSON.stringify({
          complete,
          acceptedCount: acceptedIds.size,
          requiredCount: required.length,
        }),
      },
    });

    return updated;
  });
}

export async function listCategories(communityId: string, includeArchived = false) {
  return prisma.category.findMany({
    where: {
      communityId,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(input: {
  communityId: string;
  name: string;
}) {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) {
    throw new DomainError("VALIDATION_ERROR", "Category name must be 1–60 characters.");
  }

  try {
    return await prisma.category.create({
      data: { communityId: input.communityId, name },
    });
  } catch {
    throw new DomainError(
      "CONFLICT",
      "A category with that name already exists in this community.",
    );
  }
}

export async function archiveCategory(input: {
  communityId: string;
  categoryId: string;
}) {
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, communityId: input.communityId },
  });
  if (!category) {
    throw new DomainError("NOT_FOUND", "Category not found.");
  }
  if (category.archivedAt) return category;

  return prisma.category.update({
    where: { id: category.id },
    data: { archivedAt: new Date() },
  });
}

export type ExpenseDraftInput = {
  communityId: string;
  cycleId: string;
  actorMembershipId: string;
  title: string;
  categoryLabel: string;
  categoryId: string | null;
  isOneTimeCategory: boolean;
  fixedCents: number;
  variableCents: number;
  usageLabel: string;
  dueAt: Date;
  frontedByMembershipId: string | null;
  participants: Array<{ membershipId: string; usageUnits: number }>;
  cycleRevision: number;
};

async function resolveCategoryFields(input: {
  communityId: string;
  categoryId: string | null;
  categoryLabel: string;
  isOneTimeCategory: boolean;
}) {
  if (input.categoryId) {
    const cat = await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        communityId: input.communityId,
        archivedAt: null,
      },
    });
    if (!cat) {
      throw new DomainError("VALIDATION_ERROR", "Selected category is missing or archived.");
    }
    return {
      category: cat.name,
      categoryId: cat.id,
      isOneTimeCategory: false,
    };
  }

  const label = input.categoryLabel.trim();
  if (label.length < 1 || label.length > 60) {
    throw new DomainError("VALIDATION_ERROR", "Category label must be 1–60 characters.");
  }
  return {
    category: label,
    categoryId: null as string | null,
    isOneTimeCategory: true,
  };
}

export function previewExpenseAllocation(input: {
  fixedCents: number;
  variableCents: number;
  participants: Array<{ membershipId: string; usageUnits: number }>;
}) {
  const totalCents = input.fixedCents + input.variableCents;
  return allocate({
    fixedCents: input.fixedCents,
    variableCents: input.variableCents,
    totalCents,
    participants: input.participants,
  });
}

export async function createDraftExpense(input: ExpenseDraftInput) {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 120) {
    throw new DomainError("VALIDATION_ERROR", "Title must be 2–120 characters.");
  }
  if (!input.dueAt || Number.isNaN(input.dueAt.getTime())) {
    throw new DomainError("VALIDATION_ERROR", "A due date is required for payable expenses.");
  }
  const usageLabel = input.usageLabel.trim() || "Usage units";
  const categoryFields = await resolveCategoryFields(input);

  // Validate allocation inputs early
  previewExpenseAllocation({
    fixedCents: input.fixedCents,
    variableCents: input.variableCents,
    participants: input.participants,
  });

  return prisma.$transaction(async (tx) => {
    const cycle = await tx.financialCycle.findFirst({
      where: { id: input.cycleId, communityId: input.communityId },
    });
    if (!cycle) {
      throw new DomainError("NOT_FOUND", "Open cycle not found.");
    }
    if (cycle.status !== "OPEN") {
      throw new DomainError("CYCLE_CLOSED", "This cycle is closed and read-only.");
    }
    if (cycle.revision !== input.cycleRevision) {
      throw new DomainError(
        "STALE_REVISION",
        "Cycle changed since you loaded the form. Refresh and try again.",
        { currentRevision: cycle.revision },
      );
    }

    const accepted = await tx.ruleVersion.findFirst({
      where: { cycleId: input.cycleId, status: "ACCEPTED" },
      orderBy: { versionNumber: "desc" },
    });
    if (!accepted) {
      throw new DomainError("PRECONDITION_FAILED", "An accepted rule is required before expenses.");
    }

    const membershipIds = input.participants.map((p) => p.membershipId);
    const members = await tx.membership.findMany({
      where: {
        id: { in: membershipIds },
        communityId: input.communityId,
        status: "ACTIVE",
      },
    });
    if (members.length !== membershipIds.length) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "All participants must be active members of this community.",
      );
    }

    const expense = await tx.expense.create({
      data: {
        communityId: input.communityId,
        cycleId: input.cycleId,
        ruleVersionId: accepted.id,
        status: "DRAFT",
        title,
        category: categoryFields.category,
        categoryId: categoryFields.categoryId,
        isOneTimeCategory: categoryFields.isOneTimeCategory,
        fixedCents: input.fixedCents,
        variableCents: input.variableCents,
        totalCents: input.fixedCents + input.variableCents,
        usageLabel,
        dueAt: input.dueAt,
        frontedByMembershipId: input.frontedByMembershipId,
        createdByMembershipId: input.actorMembershipId,
        participants: {
          create: input.participants.map((p) => ({
            membershipId: p.membershipId,
            usageUnits: p.usageUnits,
          })),
        },
      },
      include: { participants: true },
    });

    await tx.financialCycle.update({
      where: { id: input.cycleId },
      data: { revision: { increment: 1 } },
    });

    return expense;
  });
}

export async function updateDraftExpense(
  input: Omit<ExpenseDraftInput, "cycleId"> & { expenseId: string },
) {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 120) {
    throw new DomainError("VALIDATION_ERROR", "Title must be 2–120 characters.");
  }
  if (!input.dueAt || Number.isNaN(input.dueAt.getTime())) {
    throw new DomainError("VALIDATION_ERROR", "A due date is required for payable expenses.");
  }
  const usageLabel = input.usageLabel.trim() || "Usage units";
  const categoryFields = await resolveCategoryFields(input);

  previewExpenseAllocation({
    fixedCents: input.fixedCents,
    variableCents: input.variableCents,
    participants: input.participants,
  });

  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({
      where: { id: input.expenseId, communityId: input.communityId },
      include: { cycle: true },
    });
    if (!expense) {
      throw new DomainError("NOT_FOUND", "Expense not found.");
    }
    if (expense.status !== "DRAFT") {
      throw new DomainError("CONFLICT", "Only draft expenses can be edited.");
    }
    if (expense.cycle.status !== "OPEN") {
      throw new DomainError("PRECONDITION_FAILED", "Cycle is closed.");
    }
    if (expense.cycle.revision !== input.cycleRevision) {
      throw new DomainError(
        "STALE_REVISION",
        "Cycle changed since you loaded the form. Refresh and try again.",
        { currentRevision: expense.cycle.revision },
      );
    }

    const accepted = await tx.ruleVersion.findFirst({
      where: { cycleId: expense.cycleId, status: "ACCEPTED" },
      orderBy: { versionNumber: "desc" },
    });
    if (!accepted) {
      throw new DomainError("PRECONDITION_FAILED", "An accepted rule is required before expenses.");
    }

    const membershipIds = input.participants.map((p) => p.membershipId);
    const members = await tx.membership.findMany({
      where: {
        id: { in: membershipIds },
        communityId: input.communityId,
        status: "ACTIVE",
      },
    });
    if (members.length !== membershipIds.length) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "All participants must be active members of this community.",
      );
    }

    await tx.expenseParticipant.deleteMany({
      where: { expenseId: expense.id },
    });

    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: {
        ruleVersionId: accepted.id,
        title,
        category: categoryFields.category,
        categoryId: categoryFields.categoryId,
        isOneTimeCategory: categoryFields.isOneTimeCategory,
        fixedCents: input.fixedCents,
        variableCents: input.variableCents,
        totalCents: input.fixedCents + input.variableCents,
        usageLabel,
        dueAt: input.dueAt,
        frontedByMembershipId: input.frontedByMembershipId,
        needsRevision: false,
        participants: {
          create: input.participants.map((p) => ({
            membershipId: p.membershipId,
            usageUnits: p.usageUnits,
          })),
        },
      },
      include: { participants: true },
    });

    await tx.financialCycle.update({
      where: { id: expense.cycleId },
      data: { revision: { increment: 1 } },
    });

    await tx.auditEvent.create({
      data: {
        communityId: input.communityId,
        cycleId: expense.cycleId,
        actorMembershipId: input.actorMembershipId,
        action: "EXPENSE_DRAFT_UPDATED",
        entityType: "Expense",
        entityId: expense.id,
        payloadJson: JSON.stringify({
          totalCents: updated.totalCents,
        }),
      },
    });

    return updated;
  });
}

export async function commitExpense(input: {
  communityId: string;
  expenseId: string;
  actorMembershipId: string;
  cycleRevision: number;
  acknowledgeProjectedCapBreaches?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({
      where: { id: input.expenseId, communityId: input.communityId },
      include: { participants: true, cycle: true },
    });
    if (!expense) {
      throw new DomainError("NOT_FOUND", "Expense not found.");
    }
    if (expense.status !== "DRAFT") {
      throw new DomainError("CONFLICT", "Only draft expenses can be committed.");
    }
    if (expense.cycle.status !== "OPEN") {
      throw new DomainError("CYCLE_CLOSED", "This cycle is closed and read-only.");
    }
    if (expense.cycle.revision !== input.cycleRevision) {
      throw new DomainError(
        "STALE_REVISION",
        "Cycle changed since you loaded this page. Refresh and try again.",
        { currentRevision: expense.cycle.revision },
      );
    }
    if (expense.needsRevision || expense.participants.length === 0) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Expense needs revision before commit (participants required).",
      );
    }
    if (!expense.dueAt) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "A due date is required before committing a payable expense.",
      );
    }

    const accepted = await tx.ruleVersion.findFirst({
      where: { cycleId: expense.cycleId, status: "ACCEPTED" },
      orderBy: { versionNumber: "desc" },
    });
    if (!accepted) {
      throw new DomainError("PRECONDITION_FAILED", "Accepted rule required.");
    }

    if (accepted.cycleBudgetCapCents != null) {
      const committedSum = await tx.expense.aggregate({
        where: {
          cycleId: expense.cycleId,
          status: "COMMITTED",
        },
        _sum: { totalCents: true },
      });
      const nextTotal =
        (committedSum._sum.totalCents ?? 0) + expense.totalCents;
      if (nextTotal > accepted.cycleBudgetCapCents) {
        throw new DomainError(
          "BUDGET_CAP_EXCEEDED",
          "Committing this expense would exceed the cycle budget cap.",
          {
            cycleBudgetCapCents: accepted.cycleBudgetCapCents,
            projectedCommittedCents: nextTotal,
          },
        );
      }
    }

    const result = allocate({
      fixedCents: expense.fixedCents,
      variableCents: expense.variableCents,
      totalCents: expense.totalCents,
      participants: expense.participants.map((p) => ({
        membershipId: p.membershipId,
        usageUnits: p.usageUnits,
      })),
    });

    const breaches = await findProjectedCapBreaches({
      cycleId: expense.cycleId,
      additionalBaselines: result.lines.map((line) => ({
        membershipId: line.membershipId,
        baselineCents: line.baselineCents,
      })),
    });
    if (breaches.length > 0 && !input.acknowledgeProjectedCapBreaches) {
      throw new DomainError(
        "CAP_BREACH_ACK_REQUIRED",
        "Committing would put one or more members over a pending or approved contribution cap. Acknowledge to continue.",
        { breaches },
      );
    }

    const now = new Date();
    for (const line of result.lines) {
      await tx.allocation.create({
        data: {
          expenseId: expense.id,
          membershipId: line.membershipId,
          fixedShareCents: line.fixedShareCents,
          usageShareCents: line.usageShareCents,
          baselineCents: line.baselineCents,
          hardshipAppliedCents: 0,
          equalCoverAppliedCents: 0,
          finalChargeCents: line.baselineCents,
        },
      });
    }

    const committed = await tx.expense.update({
      where: { id: expense.id },
      data: {
        status: "COMMITTED",
        committedAt: now,
        ruleVersionId: accepted.id,
      },
    });

    for (const line of result.lines) {
      await applyPendingEqualCover(tx, {
        cycleId: expense.cycleId,
        membershipId: line.membershipId,
      });
    }

    const updated = await tx.expense.findUniqueOrThrow({
      where: { id: committed.id },
      include: {
        allocations: true,
        participants: true,
      },
    });

    await tx.financialCycle.update({
      where: { id: expense.cycleId },
      data: { revision: { increment: 1 } },
    });

    await tx.auditEvent.create({
      data: {
        communityId: input.communityId,
        cycleId: expense.cycleId,
        actorMembershipId: input.actorMembershipId,
        action: "EXPENSE_COMMITTED",
        entityType: "Expense",
        entityId: expense.id,
        payloadJson: JSON.stringify({
          totalCents: expense.totalCents,
          warnings: result.warnings,
        }),
      },
    });

    return { expense: updated, warnings: result.warnings };
  });
}
