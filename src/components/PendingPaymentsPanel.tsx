"use client";

import { useEffect, useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { MoneyText } from "@/components/MoneyText";
import { StatusBadge } from "@/components/StatusBadge";

type PendingRow = {
  id: string;
  amountCents: number;
  method: string;
  status: string;
  note: string | null;
  submittedAt: string;
  membership: {
    user: { displayName: string };
  };
  expense: { id: string; title: string } | null;
};

type PendingPaymentsPanelProps = {
  communityId: string;
};

export function PendingPaymentsPanel({ communityId }: PendingPaymentsPanelProps) {
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  async function refresh() {
    const response = await fetch(`/api/communities/${communityId}/payments`);
    const data = (await response.json()) as {
      pending?: PendingRow[];
      error?: { message?: string };
    };
    if (!response.ok) {
      setError(data.error?.message ?? "Could not load pending payments.");
      return;
    }
    setPending(data.pending ?? []);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  function act(action: "confirm" | "reject", submissionId: string) {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/communities/${communityId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          submissionId,
          reason: action === "reject" ? "Rejected by coordinator" : undefined,
        }),
      });
      const data = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        setError(
          data.error?.message ??
            `Could not ${action} payment submission.`,
        );
        return;
      }
      await refresh();
    });
  }

  return (
    <section
      className="card-surface space-y-4 p-5"
      aria-labelledby="pending-payments-heading"
    >
      <div>
        <h2 id="pending-payments-heading" className="type-h3">
          Pending payment confirmations
        </h2>
        <p className="type-caption mt-1">
          Demo submissions only. Confirming writes a contribution cash
          transaction; rejecting leaves the ledger unchanged.
        </p>
      </div>

      {error ? <ErrorAlert message={error} /> : null}

      {pending.length === 0 ? (
        <p className="type-caption">No submissions awaiting confirmation.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {pending.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-4 px-4 py-4"
            >
              <div className="flex items-start gap-3">
                <InitialsAvatar name={row.membership.user.displayName} size="sm" />
                <div>
                  <p className="font-medium text-ink">
                    {row.membership.user.displayName}
                  </p>
                  <p className="type-caption">
                    {row.expense?.title ?? "General contribution"}
                    {" · "}
                    {row.method.replaceAll("_", " ")}
                    {" · "}
                    {new Date(row.submittedAt).toISOString().slice(0, 10)}
                  </p>
                  {row.note ? (
                    <p className="mt-1 text-sm text-muted">{row.note}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <MoneyText
                      cents={row.amountCents}
                      className="font-semibold"
                    />
                    <StatusBadge status={row.status} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={() => act("confirm", row.id)}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="focus-ring rounded-full border border-danger/40 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
                  onClick={() => act("reject", row.id)}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
