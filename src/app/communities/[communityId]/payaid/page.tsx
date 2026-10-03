import {
  PayAidCapRequestForm,
  PayAidDecideButtons,
  PayAidFundingForm,
} from "@/components/PayAidForms";
import { EmptyState } from "@/components/EmptyState";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { StatGrid } from "@/components/StatGrid";
import { StatusBadge } from "@/components/StatusBadge";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { parseFeatureToggles } from "@/lib/feature-toggles";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function PayAidPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const openCycle = await getOpenCycle(communityId);
  const user = await getSessionUser();
  const membership = user
    ? await getActiveMembership(communityId, user.id)
    : null;
  const isCoordinator = membership?.role === "COORDINATOR";

  const acceptedRule = openCycle
    ? await prisma.ruleVersion.findFirst({
        where: { cycleId: openCycle.id, status: "ACCEPTED" },
        orderBy: { versionNumber: "desc" },
        select: { featureTogglesJson: true },
      })
    : null;
  const toggles = parseFeatureToggles(acceptedRule?.featureTogglesJson ?? "{}");

  if (!toggles.hardshipEnabled) {
    return (
      <div className="space-y-8">
        <PageHeader
          showBack={false}
          eyebrow={community.name}
          title="PayAid"
          description="PayAid is turned off for this community’s current rules."
        />
        <EmptyState
          title="PayAid disabled"
          description="A coordinator can enable PayAid in a new rule version if the community needs it."
        />
      </div>
    );
  }

  if (!openCycle) {
    return (
      <div className="space-y-8">
        <PageHeader
          showBack={false}
          eyebrow={community.name}
          title="PayAid"
          description="Funding pool and contribution-cap requests."
        />
        <EmptyState
          title="No open cycle"
          description="PayAid funding is scoped to a financial cycle."
        />
      </div>
    );
  }

  const [fundingReceived, pendingRequests] = await Promise.all([
    prisma.hardshipFunding.aggregate({
      where: { cycleId: openCycle.id, kind: "RECEIVED" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.contributionCapRequest.findMany({
      where: { cycleId: openCycle.id, status: "PENDING" },
      select: {
        id: true,
        requestedCapCents: true,
        explanation: true,
        status: true,
        createdAt: true,
        membershipId: true,
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
        title={isCoordinator ? "PayAid" : "My PayAid"}
        description="Aggregated funding is visible to all members. Requester names, caps, and explanations are private to coordinators and the requester."
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
            label: "Pending cap requests",
            value: pendingRequests.length,
          },
        ]}
      />

      {isCoordinator ? <PayAidFundingForm communityId={communityId} /> : null}
      {membership ? <PayAidCapRequestForm communityId={communityId} /> : null}

      <section aria-labelledby="pending-caps-heading" className="space-y-3">
        <h2 id="pending-caps-heading" className="text-xl font-semibold">
          Pending contribution caps
        </h2>

        {pendingRequests.length === 0 ? (
          <EmptyState
            title="No pending requests"
            description="Cap requests awaiting coordinator decision will appear here."
          />
        ) : (
          <ul className="divide-y divide-border border border-border bg-surface">
            {pendingRequests.map((request) => {
              const canSeePrivate =
                isCoordinator || request.membershipId === membership?.id;

              if (!canSeePrivate) {
                return (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        Pending request
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        Submitted {request.createdAt.toISOString().slice(0, 10)}
                        {" · "}
                        Details hidden for privacy
                      </p>
                    </div>
                    <StatusBadge status={request.status} />
                  </li>
                );
              }

              return (
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
                    <p className="mt-2 text-sm text-foreground">
                      {request.explanation}
                    </p>
                    {isCoordinator ? (
                      <div className="mt-3">
                        <PayAidDecideButtons
                          communityId={communityId}
                          requestId={request.id}
                        />
                      </div>
                    ) : null}
                  </div>
                  <StatusBadge status={request.status} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
