import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { WithdrawalActions } from "@/components/WithdrawalActions";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { parseFeatureToggles } from "@/lib/feature-toggles";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function WithdrawalsPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const openCycle = await getOpenCycle(communityId);
  const user = await getSessionUser();
  const membership = user
    ? await getActiveMembership(communityId, user.id)
    : null;
  const isCoordinator = membership?.role === "COORDINATOR";

  const accepted = openCycle
    ? await prisma.ruleVersion.findFirst({
        where: { cycleId: openCycle.id, status: "ACCEPTED" },
        orderBy: { versionNumber: "desc" },
        select: { featureTogglesJson: true },
      })
    : null;
  const toggles = parseFeatureToggles(accepted?.featureTogglesJson ?? "{}");

  if (!toggles.withdrawalsEnabled) {
    return (
      <div className="space-y-8">
        <PageHeader showBack={false} eyebrow={community.name} title="Withdrawals" />
        <EmptyState title="Withdrawals disabled" description="Enabled in an accepted rule." />
      </div>
    );
  }

  const [withdrawals, activeMembers] = openCycle
    ? await Promise.all([
        prisma.withdrawal.findMany({
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
        }),
        prisma.membership.findMany({
          where: { communityId, status: "ACTIVE" },
          include: { user: { select: { displayName: true } } },
          orderBy: { joinedAt: "asc" },
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title="Withdrawals"
        description="Leaving retains committed charges and drops the member from drafts. No automatic refund."
      />

      {!openCycle ? (
        <EmptyState title="No open cycle" />
      ) : (
        <>
          {membership ? (
            <WithdrawalActions
              communityId={communityId}
              membershipId={membership.id}
              cycleRevision={openCycle.revision}
              isCoordinator={Boolean(isCoordinator)}
            />
          ) : null}

          {isCoordinator ? (
            <section className="space-y-3">
              <h2 className="type-h3">Execute for a member</h2>
              <ul className="divide-y divide-border border border-border bg-surface">
                {activeMembers.map((m) => (
                  <li key={m.id} className="px-4 py-3">
                    <p className="font-medium text-ink">{m.user.displayName}</p>
                    <div className="mt-2">
                      <WithdrawalActions
                        communityId={communityId}
                        membershipId={m.id}
                        cycleRevision={openCycle.revision}
                        isCoordinator
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {withdrawals.length === 0 ? (
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
        </>
      )}
    </div>
  );
}
