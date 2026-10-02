import Link from "next/link";
import { MoneyText } from "@/components/MoneyText";
import { StatusBadge } from "@/components/StatusBadge";

export type PaymentRibbonItem = {
  expenseId: string;
  title: string;
  category: string;
  dueAt: string | null;
  outstandingCents: number;
  allocationFinalCents: number;
  paidTowardExpenseCents: number;
  state: "OVERDUE" | "DUE_SOON" | "NO_DUE_DATE" | "SETTLED";
};

type PaymentRibbonListProps = {
  communityId: string;
  ribbons: PaymentRibbonItem[];
};

const STATE_COPY: Record<PaymentRibbonItem["state"], string> = {
  OVERDUE: "Overdue",
  DUE_SOON: "Due soon",
  NO_DUE_DATE: "No due date set",
  SETTLED: "Settled",
};

export function PaymentRibbonList({
  communityId,
  ribbons,
}: PaymentRibbonListProps) {
  if (ribbons.length === 0) {
    return (
      <p className="type-caption rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center">
        No overdue or due-soon payments right now.
      </p>
    );
  }

  return (
    <ul className="space-y-3" aria-label="Payment due ribbons">
      {ribbons.map((ribbon) => {
        const tone =
          ribbon.state === "OVERDUE"
            ? "border-danger/40 bg-danger-bg"
            : ribbon.state === "DUE_SOON"
              ? "border-warning/40 bg-warning-bg"
              : "border-border bg-surface";

        return (
          <li key={ribbon.expenseId}>
            <Link
              href={`/communities/${communityId}/payments/${ribbon.expenseId}`}
              className={`focus-ring card-surface flex flex-wrap items-center justify-between gap-3 border px-4 py-4 transition-colors hover:bg-canvas/60 ${tone}`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">{ribbon.title}</p>
                  <StatusBadge status={ribbon.state} />
                </div>
                <p className="type-caption">
                  {ribbon.category}
                  {ribbon.dueAt
                    ? ` · Due ${new Date(ribbon.dueAt).toISOString().slice(0, 10)}`
                    : ` · ${STATE_COPY[ribbon.state]}`}
                </p>
              </div>
              <div className="text-right">
                <p className="type-caption">Outstanding</p>
                <MoneyText
                  cents={ribbon.outstandingCents}
                  className="font-semibold"
                  label={`${ribbon.title} outstanding`}
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
