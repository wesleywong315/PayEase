import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function RulesPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const openCycle = await getOpenCycle(communityId);

  const acceptedRule = openCycle
    ? await prisma.ruleVersion.findFirst({
        where: {
          communityId,
          cycleId: openCycle.id,
          status: "ACCEPTED",
        },
        orderBy: { versionNumber: "desc" },
        include: {
          acceptances: {
            include: {
              membership: {
                include: { user: { select: { displayName: true } } },
              },
            },
          },
        },
      })
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title="Rules"
        description="Accepted shared-spending rules for the open cycle. Propose and accept flows arrive later."
      />

      {!openCycle ? (
        <EmptyState
          title="No open cycle"
          description="Rules are scoped to a financial cycle."
        />
      ) : !acceptedRule ? (
        <EmptyState
          title="No accepted rule"
          description={`Nothing accepted yet for ${openCycle.name}.`}
        />
      ) : (
        <article className="space-y-6 border border-border bg-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">
                {acceptedRule.title}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Version {acceptedRule.versionNumber}
                {acceptedRule.acceptedAt
                  ? ` · Accepted ${acceptedRule.acceptedAt.toISOString().slice(0, 10)}`
                  : null}
              </p>
            </div>
            <StatusBadge status={acceptedRule.status} />
          </div>

          <div className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
            {acceptedRule.bodyMarkdown}
          </div>

          <section aria-labelledby="acceptances-heading" className="border-t border-border pt-4">
            <h3
              id="acceptances-heading"
              className="text-sm font-semibold uppercase tracking-wide text-muted"
            >
              Acceptances ({acceptedRule.acceptances.length})
            </h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {acceptedRule.acceptances.map((acceptance) => (
                <li
                  key={acceptance.id}
                  className="border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  {acceptance.membership.user.displayName}
                </li>
              ))}
            </ul>
          </section>
        </article>
      )}
    </div>
  );
}
