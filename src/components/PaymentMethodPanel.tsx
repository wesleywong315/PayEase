"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { MoneyText } from "@/components/MoneyText";

type PaymentMethodPanelProps = {
  communityId: string;
  expenseId: string;
  /** Full remaining charge on this expense — partial pay is not allowed. */
  requiredAmountCents: number;
};

/**
 * Tracking-only: record that an off-app payment was made. No money moves in-app.
 */
export function PaymentMethodPanel({
  communityId,
  expenseId,
  requiredAmountCents,
}: PaymentMethodPanelProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section
      className="card-surface space-y-4 p-5"
      aria-labelledby="payment-methods-heading"
    >
      <div>
        <h2 id="payment-methods-heading" className="type-h3">
          Record a payment
        </h2>
        <p className="type-caption mt-1">
          PayEase tracks charges only — it does not process money. Record that
          you paid this charge in full off-app; a coordinator confirms before
          the ledger updates.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-canvas px-4 py-3">
        <p className="type-caption font-semibold text-ink">Amount due</p>
        <p className="mt-1">
          <MoneyText cents={requiredAmountCents} size="lg" />
        </p>
        <p className="type-caption mt-1">
          Charges must be recorded in full — partial amounts are not accepted.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="pay-note" className="type-caption font-semibold text-ink">
          Note (optional)
        </label>
        <input
          id="pay-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink"
          placeholder="e.g. FPS reference, cash to treasurer"
        />
      </div>

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <p
          role="status"
          className="rounded-md border border-success/30 bg-success-bg px-4 py-3 text-sm text-success"
        >
          {success}
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending || requiredAmountCents <= 0}
        className="focus-ring rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        onClick={() => {
          setError(null);
          setSuccess(null);
          startTransition(async () => {
            if (requiredAmountCents <= 0) {
              setError("Nothing left to record on this charge.");
              return;
            }
            const response = await fetch(
              `/api/communities/${communityId}/payments`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "submit",
                  expenseId,
                  amountCents: requiredAmountCents,
                  note: note.trim() || null,
                }),
              },
            );
            const raw = await response.text();
            const data = (
              raw ? (JSON.parse(raw) as { error?: { message?: string } }) : {}
            ) as { error?: { message?: string } };
            if (!response.ok) {
              setError(
                data.error?.message ?? "Could not record payment.",
              );
              return;
            }
            setSuccess(
              "Payment recorded. Outstanding balance updates after a coordinator confirms.",
            );
            router.refresh();
          });
        }}
      >
        {pending ? "Working…" : "Record full payment"}
      </button>
    </section>
  );
}
