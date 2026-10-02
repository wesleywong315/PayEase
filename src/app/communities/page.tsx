import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { EmptyState } from "@/components/EmptyState";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { LogoutButton } from "@/components/LogoutButton";
import { MoneyText } from "@/components/MoneyText";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/server/auth/current-user";
import { getMembershipBalances } from "@/server/services/balances";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My communities",
};

function formatActivity(date: Date | null | undefined): string {
  if (!date) return "No recent activity";
  return `Updated ${date.toISOString().slice(0, 10)}`;
}

export default async function CommunityInboxPage() {
  const user = await requireSessionUser("/communities");

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: {
      community: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          expenses: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { updatedAt: true },
          },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const balances = await getMembershipBalances(memberships.map((m) => m.id));

  let personalOwe = 0;
  let personalReimburse = 0;
  let personalRefund = 0;
  for (const row of balances.values()) {
    personalOwe += row.contributionOutstandingCents;
    personalReimburse += row.reimbursementOutstandingCents;
    personalRefund += row.refundDueCents;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <BackButton href="/" label="Back to landing" />
      </div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <InitialsAvatar name={user.displayName} size="lg" />
          <div>
            <p className="type-caption">Signed in</p>
            <h1 className="type-h2">{user.displayName}</h1>
            <Link
              href="/profile"
              className="focus-ring mt-1 inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              Profile
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/communities/new"
            aria-label="Create or join a community"
            className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-lg font-bold text-white"
            title="Create or join"
          >
            +
          </Link>
          <LogoutButton />
        </div>
      </div>

      <section
        aria-labelledby="personal-summary-heading"
        className="card-surface mb-8 grid gap-4 p-5 sm:grid-cols-3"
      >
        <h2 id="personal-summary-heading" className="sr-only">
          Personal financial summary
        </h2>
        <div>
          <p className="type-caption">Contributions I still owe</p>
          <MoneyText cents={personalOwe} size="lg" className="mt-1 block text-ink" />
        </div>
        <div>
          <p className="type-caption">Reimbursements owed to me</p>
          <MoneyText
            cents={personalReimburse}
            size="lg"
            className="mt-1 block text-ink"
          />
        </div>
        <div>
          <p className="type-caption">Refunds due to me</p>
          <MoneyText
            cents={personalRefund}
            size="lg"
            className="mt-1 block text-ink"
          />
        </div>
        <p className="type-caption sm:col-span-3">
          Amounts are not automatically netted across communities.
        </p>
      </section>

      <PageHeader
        eyebrow="Inbox"
        title="My communities"
        description="Conversation-style list of communities you belong to. This is not a messaging app."
        showBack={false}
      />

      <div className="mt-6">
        {memberships.length === 0 ? (
          <EmptyState
            title="You haven’t joined a community yet."
            description="Create a community or join with an invitation."
            action={
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/communities/new"
                  className="focus-ring rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  Create community
                </Link>
                <Link
                  href="/join"
                  className="focus-ring rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink"
                >
                  Join community
                </Link>
              </div>
            }
          />
        ) : (
          <ul className="card-surface divide-y divide-border overflow-hidden">
            {memberships.map((membership) => {
              const balance = balances.get(membership.id);
              const latestExpense = membership.community.expenses[0]?.updatedAt;
              const activity = latestExpense ?? membership.community.createdAt;

              return (
                <li key={membership.id}>
                  <Link
                    href={`/communities/${membership.communityId}`}
                    className="focus-ring flex items-start gap-3 px-4 py-4 transition hover:bg-canvas/80"
                  >
                    <InitialsAvatar name={membership.community.name} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="truncate font-semibold text-ink">
                          {membership.community.name}
                        </p>
                        <span className="type-caption shrink-0">
                          {formatActivity(activity)}
                        </span>
                      </div>
                      <p className="type-caption">
                        Your role:{" "}
                        {membership.role === "COORDINATOR"
                          ? "Coordinator (collection contact)"
                          : "Member"}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(balance?.contributionOutstandingCents ?? 0) > 0 ? (
                          <span className="rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning">
                            You owe{" "}
                            <MoneyText
                              cents={balance!.contributionOutstandingCents}
                              className="inline"
                            />
                          </span>
                        ) : null}
                        {(balance?.reimbursementOutstandingCents ?? 0) > 0 ? (
                          <span className="rounded-full bg-success-bg px-2.5 py-1 text-xs font-medium text-success">
                            Reimbursement due{" "}
                            <MoneyText
                              cents={balance!.reimbursementOutstandingCents}
                              className="inline"
                            />
                          </span>
                        ) : null}
                        {(balance?.refundDueCents ?? 0) > 0 ? (
                          <span className="rounded-full bg-warm/15 px-2.5 py-1 text-xs font-medium text-warm">
                            Refund due{" "}
                            <MoneyText
                              cents={balance!.refundDueCents}
                              className="inline"
                            />
                          </span>
                        ) : null}
                        {(balance?.contributionOutstandingCents ?? 0) === 0 &&
                        (balance?.reimbursementOutstandingCents ?? 0) === 0 &&
                        (balance?.refundDueCents ?? 0) === 0 ? (
                          <span className="type-caption">No outstanding balances</span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
