import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseForm } from "@/components/ExpenseForm";
import { PageHeader } from "@/components/PageHeader";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";
import { listCategories } from "@/server/services/expenses";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string; expenseId: string }>;
};

export default async function EditExpensePage({ params }: PageProps) {
  const { communityId, expenseId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const user = await requireSessionUser(
    `/communities/${communityId}/expenses/${expenseId}/edit`,
  );
  const membership = await getActiveMembership(communityId, user.id);

  if (!membership || membership.role !== "COORDINATOR") {
    return (
      <div className="space-y-8">
        <PageHeader
          showBack={false}
          eyebrow={community.name}
          title="Edit expense"
        />
        <EmptyState
          title="Coordinator access required"
          description="Only community coordinators can edit draft expenses."
          action={
            <Link
              href={`/communities/${communityId}/expenses/${expenseId}`}
              className="focus-ring text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              Back to expense
            </Link>
          }
        />
      </div>
    );
  }

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, communityId },
    include: { participants: true },
  });
  if (!expense) notFound();

  if (expense.status !== "DRAFT") {
    return (
      <div className="space-y-8">
        <PageHeader
          showBack={false}
          eyebrow={community.name}
          title="Edit expense"
        />
        <EmptyState
          title="This expense is no longer a draft"
          description="Committed expenses cannot be edited."
          action={
            <Link
              href={`/communities/${communityId}/expenses/${expenseId}`}
              className="focus-ring text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              View expense
            </Link>
          }
        />
      </div>
    );
  }

  const openCycle = await getOpenCycle(communityId);
  if (!openCycle) {
    return (
      <div className="space-y-8">
        <PageHeader
          showBack={false}
          eyebrow={community.name}
          title="Edit expense"
        />
        <EmptyState
          title="No open cycle"
          description="Open a financial cycle before editing expenses."
        />
      </div>
    );
  }

  const [members, categories] = await Promise.all([
    prisma.membership.findMany({
      where: { communityId, status: "ACTIVE" },
      include: { user: { select: { displayName: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    listCategories(communityId, false),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={openCycle.name}
        title="Edit draft expense"
        description="Update amounts, participants, or due date. Changes stay in draft until you commit."
      />

      <ExpenseForm
        communityId={communityId}
        expenseId={expense.id}
        cycleRevision={openCycle.revision}
        members={members.map((m) => ({
          id: m.id,
          displayName: m.user.displayName,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          title: expense.title,
          categoryId: expense.categoryId,
          categoryLabel: expense.category,
          isOneTimeCategory: expense.isOneTimeCategory,
          fixedCents: expense.fixedCents,
          variableCents: expense.variableCents,
          usageLabel: expense.usageLabel,
          dueAt: expense.dueAt?.toISOString() ?? null,
          frontedByMembershipId: expense.frontedByMembershipId,
          participants: expense.participants.map((p) => ({
            membershipId: p.membershipId,
            usageUnits: p.usageUnits,
          })),
        }}
      />
    </div>
  );
}
