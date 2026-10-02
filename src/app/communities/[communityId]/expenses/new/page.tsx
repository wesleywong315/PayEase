import Link from "next/link";
import { CategoryManager } from "@/components/CategoryManager";
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
  params: Promise<{ communityId: string }>;
};

export default async function NewExpensePage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const user = await requireSessionUser(
    `/communities/${communityId}/expenses/new`,
  );
  const membership = await getActiveMembership(communityId, user.id);

  if (!membership || membership.role !== "COORDINATOR") {
    return (
      <div className="space-y-8">
        <PageHeader
          showBack={false}
          eyebrow={community.name}
          title="New expense"
        />
        <EmptyState
          title="Coordinator access required"
          description="Only community coordinators can create expenses."
          action={
            <Link
              href={`/communities/${communityId}/finance`}
              className="focus-ring text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              Back to finance
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
          title="New expense"
        />
        <EmptyState
          title="No open cycle"
          description="Open a financial cycle before creating expenses."
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
        title="New expense"
        description="Draft an expense with live allocation preview. Commit from the expense detail page when ready."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ExpenseForm
          communityId={communityId}
          cycleRevision={openCycle.revision}
          members={members.map((m) => ({
            id: m.id,
            displayName: m.user.displayName,
          }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
        <CategoryManager
          communityId={communityId}
          initialCategories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            archivedAt: c.archivedAt?.toISOString() ?? null,
          }))}
        />
      </div>
    </div>
  );
}
