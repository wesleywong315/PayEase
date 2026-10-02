import { EmptyState } from "@/components/EmptyState";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { StatGrid } from "@/components/StatGrid";
import { StatusBadge } from "@/components/StatusBadge";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function HardshipPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const openCycle = await getOpenCycle(communityId);

  if (!openCycle) {
    return (
      <div className="space-y-8">
        <PageHeader
        showBack={false}
          eyebrow={community.name}
          title="Hardship"
          description="Funding pool and contribution-cap requests."
        />
        <EmptyState
          title="No open cycle"
          description="Hardship funding is scoped to a financial cycle."
        />
      </div>
    );
  }

  const [fundingReceived, fundingPledged, pendingRequests] = await Promise.all([
    prisma.hardshipFunding.aggregate({
      where: { cycleId: openCycle.id, kind: "RECEIVED" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.hardshipFunding.aggregate({
      where: { cycleId: openCycle.id, kind: "PLEDGED" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.contributionCapRequest.findMany({
      where: { cycleId: openCycle.id, status: "PENDING" },
      select: {
        id: true,
        requestedCapCents: true,
        status: true,
        createdAt: true,
        membership: {
          select: {
            user: { select: { displayName: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={openCycle.name}
        title="Hardship"
        description="Aggregated funding and pending cap requests. Private explanations are withheld in the UI design."
      />

      <StatGrid
        items={[
          {
            label: "Funding received",
            value: (
              <MoneyText
                cents={fundingReceived._sum.amountCents ?? 0}
                label="Funding received"
              />
            ),
            hint: `${fundingReceived._count} record${fundingReceived._count === 1 ? "" : "s"}`,
          },
          {
            label: "Funding pledged",
            value: (
              <MoneyText
                cents={fundingPledged._sum.amountCents ?? 0}
                label="Funding pledged"
              />
            ),
            hint: `${fundingPledged._count} record${fundingPledged._count === 1 ? "" : "s"}`,
          },
          {
            label: "Pending cap requests",
            value: pendingRequests.length,
          },
        ]}
      />

      <section aria-labelledby="pending-caps-heading" className="space-y-3">
        <h2 id="pending-caps-heading" className="text-xl font-semibold">
          Pending contribution caps
        </h2>
        <p className="text-sm text-muted">
          Private explanation field hidden in UI for non-coordinator — design
          stub. Full privacy enforcement arrives in Phase 4.
        </p>

        {pendingRequests.length === 0 ? (
          <EmptyState
            title="No pending requests"
            description="Cap requests awaiting coordinator decision will appear here."
          />
        ) : (
          <ul className="divide-y divide-border border border-border bg-surface">
            {pendingRequests.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {request.membership.user.displayName}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Requested cap{" "}
                    <MoneyText cents={request.requestedCapCents} />
                    {" · "}
                    Submitted {request.createdAt.toISOString().slice(0, 10)}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    Explanation: not shown (privacy design)
                  </p>
                </div>
                <StatusBadge status={request.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
