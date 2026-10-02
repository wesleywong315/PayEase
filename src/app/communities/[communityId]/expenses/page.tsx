import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function ExpensesPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const openCycle = await getOpenCycle(communityId);

  const expenses = openCycle
    ? await prisma.expense.findMany({
        where: { communityId, cycleId: openCycle.id },
        orderBy: { createdAt: "asc" },
        include: {
          frontedBy: {
            include: { user: { select: { displayName: true } } },
          },
          _count: { select: { participants: true } },
        },
      })
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title="Expenses"
        description={
          openCycle
            ? `Draft and committed expenses for ${openCycle.name}. Create/commit APIs arrive in later phases.`
            : "Expenses require an open financial cycle."
        }
      />

      {!openCycle ? (
        <EmptyState title="No open cycle" description="Open a cycle to list expenses." />
      ) : expenses.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          description="Draft and committed expenses will appear here."
        />
      ) : (
        <ul className="divide-y divide-border border border-border bg-surface">
          {expenses.map((expense) => (
            <li key={expense.id}>
              <Link
                href={`/communities/${communityId}/expenses/${expense.id}`}
                className="grid gap-3 px-4 py-4 transition-colors hover:bg-background sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{expense.title}</p>
                    <StatusBadge status={expense.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {expense.category}
                    {" · "}
                    {expense._count.participants} participant
                    {expense._count.participants === 1 ? "" : "s"}
                    {expense.frontedBy
                      ? ` · Fronted by ${expense.frontedBy.user.displayName}`
                      : null}
                  </p>
                </div>
                <MoneyText
                  cents={expense.totalCents}
                  className="text-lg font-semibold"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
