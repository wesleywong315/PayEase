import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PaymentMethodPanel } from "@/components/PaymentMethodPanel";
import {
  PaymentRibbonList,
  type PaymentRibbonItem,
} from "@/components/PaymentRibbonList";
import { PendingPaymentsPanel } from "@/components/PendingPaymentsPanel";
import { MoneyText } from "@/components/MoneyText";
import { getCommunityOrNotFound, getOpenCycle } from "@/lib/community";
import { requireSessionUser } from "@/server/auth/current-user";
import { getActiveMembership } from "@/server/auth/permissions";
import { getMembershipBalances } from "@/server/services/balances";
import { getMemberPaymentRibbons } from "@/server/services/payments";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

export default async function PaymentsPage({ params }: PageProps) {
  const { communityId } = await params;
  const community = await getCommunityOrNotFound(communityId);
  const user = await requireSessionUser(`/communities/${communityId}/payments`);
  const membership = await getActiveMembership(communityId, user.id);

  if (!membership) {
    return (
      <div className="space-y-8">
        <PageHeader showBack={false} eyebrow={community.name} title="Payments" />
        <EmptyState
          title="Members only"
          description="Join this community to view payment ribbons."
        />
      </div>
    );
  }

  const isCoordinator = membership.role === "COORDINATOR";
  const openCycle = await getOpenCycle(communityId);

  const ribbonsRaw = await getMemberPaymentRibbons({
    communityId,
    membershipId: membership.id,
  });
  const ribbons: PaymentRibbonItem[] = ribbonsRaw.map((r) => ({
    expenseId: r.expenseId,
    title: r.title,
    category: r.category,
    dueAt: r.dueAt?.toISOString() ?? null,
    outstandingCents: r.outstandingCents,
    allocationFinalCents: r.allocationFinalCents,
    paidTowardExpenseCents: r.paidTowardExpenseCents,
    state: r.state,
  }));

  const balances = await getMembershipBalances([membership.id]);
  const outstanding =
    balances.get(membership.id)?.contributionOutstandingCents ?? 0;

  const primaryExpenseId = ribbons[0]?.expenseId ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        showBack={false}
        eyebrow={community.name}
        title={isCoordinator ? "Payments" : "My payments"}
        description="Track overdue and due-soon charges. Record off-app payments for coordinator confirmation — PayEase does not process money."
      />

      {!openCycle ? (
        <EmptyState
          title="No open cycle"
          description="Payments require an open financial cycle."
        />
      ) : (
        <>
          <section className="card-surface p-5" aria-labelledby="balance-heading">
            <h2 id="balance-heading" className="type-h3">
              Your contribution outstanding
            </h2>
            <p className="mt-2">
              <MoneyText cents={outstanding} size="lg" />
            </p>
          </section>

          <section aria-labelledby="ribbons-heading" className="space-y-3">
            <h2 id="ribbons-heading" className="type-h3">
              Due ribbons
            </h2>
            <PaymentRibbonList communityId={communityId} ribbons={ribbons} />
          </section>

          {primaryExpenseId &&
          outstanding > 0 &&
          (ribbons[0]?.outstandingCents ?? 0) > 0 ? (
            <PaymentMethodPanel
              communityId={communityId}
              expenseId={primaryExpenseId}
              requiredAmountCents={ribbons[0]!.outstandingCents}
            />
          ) : null}

          {isCoordinator ? (
            <PendingPaymentsPanel communityId={communityId} />
          ) : null}
        </>
      )}
    </div>
  );
}
