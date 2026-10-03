import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function FinancePage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const openCycle = await getOpenCycle(communityId);
  const user = await getSessionUser();
  const membership = user
    ? await getActiveMembership(communityId, user.id)
    : null;
  const isCoordinator = membership?.role === "COORDINATOR";

  const [expenses, credits] = openCycle
    ? await Promise.all([
        prisma.expense.findMany({
          where: { communityId, cycleId: openCycle.id },
          orderBy: { createdAt: "asc" },
          include: {
            frontedBy: {
              include: { user: { select: { displayName: true } } },
            },
            _count: { select: { participants: true } },
          },
        }),
        prisma.credit.findMany({
          where: { communityId, cycleId: openCycle.id },
          orderBy: { receivedAt: "desc" },
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title="Finance"
        description={
          openCycle
            ? `Expenses and pooled credits for ${openCycle.name}.`
            : "Finance requires an open financial cycle."
        }
        actions={
          isCoordinator && openCycle ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/communities/${communityId}/credits/new`}
                className="focus-ring rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink"
              >
                New credit
              </Link>
              <Link
                href={`/communities/${communityId}/expenses/new`}
                className="focus-ring rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                New expense
              </Link>
            </div>
          ) : null
        }
      />

      {!openCycle ? (
        <EmptyState
          title="No open cycle"
          description="Open a cycle to manage expenses and credits."
        />
      ) : (
        <>
          <section aria-labelledby="credits-heading" className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2
                id="credits-heading"
                className="text-base font-semibold text-ink"
              >
                Credits (pool)
              </h2>
              {isCoordinator ? (
                <Link
                  href={`/communities/${communityId}/credits/new`}
                  className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
                >
                  Add credit
                </Link>
              ) : null}
            </div>
            <p className="type-caption">
              Grants, subsidies, and other pooled inflows. PayAid fund
              contributions also feed this pool.
            </p>
            {credits.length === 0 ? (
              <EmptyState
                title="No credits yet"
                description="Record a subsidy or grant to grow the community pool."
                action={
                  isCoordinator ? (
                    <Link
                      href={`/communities/${communityId}/credits/new`}
                      className="focus-ring rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink"
                    >
                      Record first credit
                    </Link>
                  ) : null
                }
              />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {credits.map((credit) => (
                  <li
                    key={credit.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {credit.title}
                      </p>
                      <p className="type-caption truncate">
                        {credit.category}
                        {" · "}
                        {credit.receivedAt.toISOString().slice(0, 10)}
                      </p>
                    </div>
                    <MoneyText
                      cents={credit.amountCents}
                      className="shrink-0 font-semibold text-success"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="expenses-heading" className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2
                id="expenses-heading"
                className="text-base font-semibold text-ink"
              >
                Expenses
              </h2>
              {isCoordinator ? (
                <Link
                  href={`/communities/${communityId}/expenses/new`}
                  className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
                >
                  New expense
                </Link>
              ) : null}
            </div>
            {expenses.length === 0 ? (
              <EmptyState
                title="No expenses yet"
                description="Draft and committed expenses will appear here."
                action={
                  isCoordinator ? (
                    <Link
                      href={`/communities/${communityId}/expenses/new`}
                      className="focus-ring rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
                    >
                      Create first expense
                    </Link>
                  ) : null
                }
              />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {expenses.map((expense) => (
                  <li key={expense.id} className="flex items-stretch">
                    <Link
                      href={`/communities/${communityId}/expenses/${expense.id}`}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-canvas/70"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-ink">
                            {expense.title}
                          </p>
                          <StatusBadge status={expense.status} />
                        </div>
                        <p className="type-caption truncate">
                          {expense.category}
                          {" · "}
                          {expense._count.participants} participant
                          {expense._count.participants === 1 ? "" : "s"}
                          {expense.dueAt
                            ? ` · Due ${expense.dueAt.toISOString().slice(0, 10)}`
                            : ""}
                        </p>
                      </div>
                      <MoneyText
                        cents={expense.totalCents}
                        className="shrink-0 font-semibold"
                      />
                    </Link>
                    {isCoordinator && expense.status === "DRAFT" ? (
                      <Link
                        href={`/communities/${communityId}/expenses/${expense.id}/edit`}
                        className="focus-ring flex shrink-0 items-center border-l border-border px-3 text-sm font-semibold text-ink hover:bg-canvas/70"
                      >
                        Edit
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
