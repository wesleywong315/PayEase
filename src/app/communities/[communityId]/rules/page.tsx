import { EmptyState } from "@/components/EmptyState";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { RuleSettingsForm } from "@/components/RuleSettingsForm";
import { StatusBadge } from "@/components/StatusBadge";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";
import {
  parseFeatureToggles,
} from "@/server/services/expenses";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function RulesPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const openCycle = await getOpenCycle(communityId);
  const user = await getSessionUser();
  const membership = user
    ? await getActiveMembership(communityId, user.id)
    : null;
  const isCoordinator = membership?.role === "COORDINATOR";

  const ruleVersions = openCycle
    ? await prisma.ruleVersion.findMany({
        where: { communityId, cycleId: openCycle.id },
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
    : [];

  const acceptedRule =
    ruleVersions.find((r) => r.status === "ACCEPTED") ?? null;
  const toggles = acceptedRule
    ? parseFeatureToggles(acceptedRule.featureTogglesJson)
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title="Rules"
        description="Accepted shared-spending rules for the open cycle. New versions capture feature toggles and optional budget caps."
      />

      {!openCycle ? (
        <EmptyState
          title="No open cycle"
          description="Rules are scoped to a financial cycle."
        />
      ) : (
        <>
          {!acceptedRule ? (
            <EmptyState
              title="No accepted rule"
              description={`Nothing accepted yet for ${openCycle.name}.`}
            />
          ) : (
            <article className="card-surface space-y-6 p-6">
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

              <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <dt className="type-caption">Equal-share fallback</dt>
                  <dd className="text-sm font-medium text-ink">
                    {acceptedRule.equalShareFallbackWhenZeroUsage
                      ? "Enabled"
                      : "Disabled"}
                  </dd>
                </div>
                <div>
                  <dt className="type-caption">Cycle budget cap</dt>
                  <dd className="text-sm font-medium text-ink">
                    {acceptedRule.cycleBudgetCapCents == null ? (
                      "Uncapped"
                    ) : (
                      <MoneyText cents={acceptedRule.cycleBudgetCapCents} />
                    )}
                  </dd>
                </div>
                {toggles ? (
                  <>
                    <div>
                      <dt className="type-caption">PayAid</dt>
                      <dd className="text-sm font-medium text-ink">
                        {toggles.hardshipEnabled ? "Enabled" : "Disabled"}
                      </dd>
                    </div>
                    <div>
                      <dt className="type-caption">Withdrawals</dt>
                      <dd className="text-sm font-medium text-ink">
                        {toggles.withdrawalsEnabled ? "Enabled" : "Disabled"}
                      </dd>
                    </div>
                    <div>
                      <dt className="type-caption">Contributions</dt>
                      <dd className="text-sm font-medium text-ink">
                        {toggles.contributionsEnabled ? "Enabled" : "Disabled"}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>

              <section
                aria-labelledby="acceptances-heading"
                className="border-t border-border pt-4"
              >
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

          {isCoordinator ? (
            <RuleSettingsForm
              communityId={communityId}
              initial={
                acceptedRule && toggles
                  ? {
                      title: acceptedRule.title,
                      bodyMarkdown: acceptedRule.bodyMarkdown,
                      equalShareFallbackWhenZeroUsage:
                        acceptedRule.equalShareFallbackWhenZeroUsage,
                      hardshipEnabled: toggles.hardshipEnabled,
                      withdrawalsEnabled: toggles.withdrawalsEnabled,
                      contributionsEnabled: toggles.contributionsEnabled,
                      cycleBudgetCapCents: acceptedRule.cycleBudgetCapCents,
                    }
                  : undefined
              }
            />
          ) : null}

          {ruleVersions.length > 0 ? (
            <section aria-labelledby="rule-history-heading" className="space-y-3">
              <h2 id="rule-history-heading" className="type-h3">
                Version history
              </h2>
              <ul className="divide-y divide-border border border-border bg-surface">
                {ruleVersions.map((version) => {
                  const vToggles = parseFeatureToggles(version.featureTogglesJson);
                  return (
                    <li
                      key={version.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-ink">
                          v{version.versionNumber}: {version.title}
                        </p>
                        <p className="type-caption">
                          PayAid {vToggles.hardshipEnabled ? "on" : "off"}
                          {" · "}
                          Withdrawals{" "}
                          {vToggles.withdrawalsEnabled ? "on" : "off"}
                          {" · "}
                          Contributions{" "}
                          {vToggles.contributionsEnabled ? "on" : "off"}
                          {" · "}
                          Cap{" "}
                          {version.cycleBudgetCapCents == null
                            ? "none"
                            : `HK$${(version.cycleBudgetCapCents / 100).toFixed(2)}`}
                        </p>
                      </div>
                      <StatusBadge status={version.status} />
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
