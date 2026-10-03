import { prisma } from "@/lib/db";
import { DomainError } from "@/server/services/communities";
import { creditEqualCoverToActiveMembers } from "@/server/services/equal-cover";
import { requireFeatureEnabled } from "@/server/services/ledger";

export async function listCreditCategories(
  communityId: string,
  includeArchived = false,
) {
  return prisma.creditCategory.findMany({
    where: {
      communityId,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: { name: "asc" },
  });
}

export async function createCreditCategory(input: {
  communityId: string;
  name: string;
}) {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Category name must be 1–60 characters.",
    );
  }

  try {
    return await prisma.creditCategory.create({
      data: { communityId: input.communityId, name },
    });
  } catch {
    throw new DomainError(
      "CONFLICT",
      "A credit category with that name already exists in this community.",
    );
  }
}

export async function archiveCreditCategory(input: {
  communityId: string;
  categoryId: string;
}) {
  const category = await prisma.creditCategory.findFirst({
    where: { id: input.categoryId, communityId: input.communityId },
  });
  if (!category) {
    throw new DomainError("NOT_FOUND", "Credit category not found.");
  }
  if (category.archivedAt) return category;

  return prisma.creditCategory.update({
    where: { id: category.id },
    data: { archivedAt: new Date() },
  });
}

async function resolveCreditCategoryFields(input: {
  communityId: string;
  categoryId: string | null;
  categoryLabel: string;
  isOneTimeCategory: boolean;
}): Promise<{ category: string; categoryId: string | null; isOneTimeCategory: boolean }> {
  if (input.isOneTimeCategory || !input.categoryId) {
    const label = input.categoryLabel.trim();
    if (label.length < 1 || label.length > 60) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "Category label must be 1–60 characters.",
      );
    }
    return {
      category: label,
      categoryId: null,
      isOneTimeCategory: true,
    };
  }

  const cat = await prisma.creditCategory.findFirst({
    where: {
      id: input.categoryId,
      communityId: input.communityId,
      archivedAt: null,
    },
  });
  if (!cat) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Selected credit category is missing or archived.",
    );
  }
  return {
    category: cat.name,
    categoryId: cat.id,
    isOneTimeCategory: false,
  };
}

export async function createCredit(input: {
  communityId: string;
  cycleId: string;
  actorMembershipId: string;
  title: string;
  categoryId: string | null;
  categoryLabel: string;
  isOneTimeCategory: boolean;
  amountCents: number;
  equalCoverCents?: number;
  payAidCents?: number;
  note?: string | null;
  receivedAt?: Date;
  idempotencyKey: string;
}) {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 120) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Title must be 2–120 characters.",
    );
  }
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Amount must be a positive HKD amount.",
    );
  }
  const payAidCents = input.payAidCents ?? 0;
  const equalCoverCents =
    input.equalCoverCents ?? input.amountCents - payAidCents;
  if (
    !Number.isSafeInteger(equalCoverCents) ||
    !Number.isSafeInteger(payAidCents) ||
    equalCoverCents < 0 ||
    payAidCents < 0 ||
    equalCoverCents + payAidCents !== input.amountCents
  ) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Equal-cover and PayAid cents must be non-negative and sum to the credit amount.",
    );
  }

  const cycle = await prisma.financialCycle.findFirst({
    where: {
      id: input.cycleId,
      communityId: input.communityId,
      status: "OPEN",
    },
  });
  if (!cycle) {
    throw new DomainError("NOT_FOUND", "Open cycle not found.");
  }

  if (payAidCents > 0) {
    await requireFeatureEnabled(
      input.cycleId,
      "hardshipEnabled",
      "PayAid is disabled for the accepted rule, so this credit cannot include a PayAid slice.",
    );
  }

  const categoryFields = await resolveCreditCategoryFields({
    communityId: input.communityId,
    categoryId: input.categoryId,
    categoryLabel: input.categoryLabel,
    isOneTimeCategory: input.isOneTimeCategory,
  });

  const receivedAt = input.receivedAt ?? new Date();
  const note = input.note?.trim() || null;

  try {
    return await prisma.$transaction(async (tx) => {
      const cash = await tx.cashTransaction.create({
        data: {
          cycleId: input.cycleId,
          type: "CREDIT_RECEIPT",
          amountCents: input.amountCents,
          membershipId: null,
          expenseId: null,
          idempotencyKey: input.idempotencyKey,
          note: note ?? title,
          manuallyConfirmed: true,
          recordedByMembershipId: input.actorMembershipId,
        },
      });

      const credit = await tx.credit.create({
        data: {
          communityId: input.communityId,
          cycleId: input.cycleId,
          title,
          category: categoryFields.category,
          categoryId: categoryFields.categoryId,
          isOneTimeCategory: categoryFields.isOneTimeCategory,
          amountCents: input.amountCents,
          equalCoverCents,
          payAidCents,
          unallocatedRemainderCents: 0,
          note,
          receivedAt,
          recordedByMembershipId: input.actorMembershipId,
          cashTransactionId: cash.id,
        },
      });

      const { unallocatedRemainderCents } =
        await creditEqualCoverToActiveMembers(tx, {
          communityId: input.communityId,
          cycleId: input.cycleId,
          equalCoverCents,
        });

      if (unallocatedRemainderCents !== 0) {
        await tx.credit.update({
          where: { id: credit.id },
          data: { unallocatedRemainderCents },
        });
      }

      if (payAidCents > 0) {
        await tx.hardshipFunding.create({
          data: {
            cycleId: input.cycleId,
            kind: "RECEIVED",
            amountCents: payAidCents,
            note: note ?? `PayAid slice of ${title}`,
            recordedByMembershipId: input.actorMembershipId,
            cashTransactionId: null,
            creditId: credit.id,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          communityId: input.communityId,
          cycleId: input.cycleId,
          actorMembershipId: input.actorMembershipId,
          action: "CREDIT_RECORDED",
          entityType: "Credit",
          entityId: credit.id,
          payloadJson: JSON.stringify({
            title,
            amountCents: input.amountCents,
            equalCoverCents,
            payAidCents,
            category: categoryFields.category,
          }),
        },
      });

      return tx.credit.findUniqueOrThrow({ where: { id: credit.id } });
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw new DomainError(
        "IDEMPOTENCY_CONFLICT",
        "That credit was already recorded (duplicate idempotency key).",
      );
    }
    throw err;
  }
}

export async function listCredits(input: {
  communityId: string;
  cycleId: string;
}) {
  return prisma.credit.findMany({
    where: { communityId: input.communityId, cycleId: input.cycleId },
    orderBy: { receivedAt: "desc" },
  });
}
