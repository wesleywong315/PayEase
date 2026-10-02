import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { parseFeatureToggles } from "@/lib/feature-toggles";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

type HubLink = {
  href: string;
  title: string;
  description: string;
};

export default async function CommunityHubPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const user = await getSessionUser();
  const membership = user
    ? await getActiveMembership(communityId, user.id)
    : null;
  const isCoordinator = membership?.role === "COORDINATOR";
  const isMember = membership?.role === "MEMBER";

  const openCycle = await getOpenCycle(communityId);
  const acceptedRule = openCycle
    ? await prisma.ruleVersion.findFirst({
        where: { cycleId: openCycle.id, status: "ACCEPTED" },
        orderBy: { versionNumber: "desc" },
        select: { featureTogglesJson: true },
      })
    : null;
  const toggles = parseFeatureToggles(acceptedRule?.featureTogglesJson ?? "{}");

  const base = `/communities/${communityId}`;
  const links: HubLink[] = [
    {
      href: `${base}/rules`,
      title: "Rules",
      description: "Shared spending rules, feature toggles, and budget caps.",
    },
  ];

  if (toggles.withdrawalsEnabled) {
    links.push({
      href: `${base}/withdrawals`,
      title: isCoordinator ? "Withdrawals" : "My withdrawals",
      description: "Track members leaving the cycle and retained obligations.",
    });
  }

  if (isCoordinator) {
    links.push({
      href: `${base}/updates`,
      title: "Updates",
      description: "Coordinator feed for payment and membership activity.",
    });
    links.push({
      href: `${base}/invitations`,
      title: "Members / Invitations",
      description: "Invite teammates and manage community membership.",
    });
  }

  if (toggles.hardshipEnabled) {
    links.push({
      href: `${base}/payaid`,
      title: isCoordinator ? "PayAid" : "My PayAid",
      description: "PayAid funding pool and contribution-cap requests.",
    });
  }

  if (isMember) {
    links.push({
      href: `${base}/payments`,
      title: "My payments",
      description: "See what you owe and record contribution payments.",
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title="Community"
        description="Rules, withdrawals, updates, and other community tools."
      />

      {links.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Community tools appear once you have an active membership."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="focus-ring flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-canvas/70"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-ink">{link.title}</p>
                  <p className="type-caption">{link.description}</p>
                </div>
                <span className="shrink-0 text-muted" aria-hidden="true">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="size-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m8.25 4.5 7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
