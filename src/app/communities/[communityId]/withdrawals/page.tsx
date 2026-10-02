import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function WithdrawalsPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const openCycle = await getOpenCycle(communityId);

  const withdrawals = openCycle
    ? await prisma.withdrawal.findMany({
        where: { cycleId: openCycle.id },
        include: {
          membership: {
            include: { user: { select: { displayName: true } } },
          },
          executedBy: {
            include: { user: { select: { displayName: true } } },
          },
        },
        orderBy: { executedAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title="Withdrawals"
        description="Leaving a cycle retains committed obligations and releases uncommitted draft participation."
      />

      <section className="space-y-3 border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Policy: RETAIN_COMMITTED_RELEASE_UNCOMMITTED
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          When a member withdraws mid-cycle, PayEase keeps their share of already
          committed expenses and drops them from draft expenses that have not
          been locked. The withdrawal simulator and execution API arrive in a
          later phase — this page is a design stub for that flow.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Committed allocations remain owed until settlement or refund.</li>
          <li>Draft participation is released without recomputing past commits.</li>
          <li>Coordinators will preview the impact before confirming leave.</li>
        </ul>
      </section>

      {!openCycle ? (
        <EmptyState
          title="No open cycle"
          description="Withdrawals are recorded against a financial cycle."
        />
      ) : withdrawals.length === 0 ? (
        <EmptyState
          title="No withdrawals recorded"
          description={`Nobody has left ${openCycle.name} yet.`}
        />
      ) : (
        <ul className="divide-y divide-border border border-border bg-surface">
          {withdrawals.map((withdrawal) => (
            <li key={withdrawal.id} className="px-4 py-3 text-sm">
              <p className="font-medium text-foreground">
                {withdrawal.membership.user.displayName} left
              </p>
              <p className="mt-1 text-muted">
                Executed by {withdrawal.executedBy.user.displayName} on{" "}
                {withdrawal.executedAt.toISOString().slice(0, 10)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
