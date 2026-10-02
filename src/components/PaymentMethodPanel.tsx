"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { MoneyText } from "@/components/MoneyText";
import { parseHkdToCents } from "@/lib/money";

type PaymentMethodPanelProps = {
  communityId: string;
  expenseId: string;
  defaultAmountCents: number;
  maxOutstandingCents: number;
};

export function PaymentMethodPanel({
  communityId,
  expenseId,
  defaultAmountCents,
  maxOutstandingCents,
}: PaymentMethodPanelProps) {
  const router = useRouter();
  const defaultHkd =
    defaultAmountCents > 0
      ? (defaultAmountCents / 100).toFixed(2)
      : "";
  const [amountHkd, setAmountHkd] = useState(defaultHkd);
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
          Submit a payment
        </h2>
        <p className="type-caption mt-1">
          This is a demo. Submitting only creates a pending confirmation for the
          coordinator — no real money moves and balances do not change until
          confirmed.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled
          className="rounded-xl border border-border bg-canvas px-4 py-3 text-sm font-semibold text-muted opacity-70"
          title="Coming soon"
        >
          Alipay
          <span className="mt-1 block type-caption">Coming soon</span>
        </button>
        <button
          type="button"
          disabled
          className="rounded-xl border border-border bg-canvas px-4 py-3 text-sm font-semibold text-muted opacity-70"
          title="Coming soon"
        >
          Wallet
          <span className="mt-1 block type-caption">Coming soon</span>
        </button>
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-semibold text-ink">
          Demo / Simulate
          <span className="mt-1 block type-caption font-normal">
            Available for this prototype
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="pay-amount"
          className="type-caption font-semibold text-ink"
        >
          Amount (HKD)
        </label>
        <input
          id="pay-amount"
          inputMode="decimal"
          value={amountHkd}
          onChange={(e) => setAmountHkd(e.target.value)}
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 font-mono text-sm text-ink"
        />
        <p className="type-caption">
          Outstanding contribution balance:{" "}
          <MoneyText cents={maxOutstandingCents} />
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
          placeholder="Reference for the coordinator"
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
        disabled={pending || maxOutstandingCents <= 0}
        className="focus-ring rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        onClick={() => {
          setError(null);
          setSuccess(null);
          startTransition(async () => {
            const amountCents = parseHkdToCents(amountHkd);
            if (amountCents === null || amountCents <= 0) {
              setError("Enter a valid positive HKD amount.");
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
                  amountCents,
                  method: "DEMO_SIMULATE",
                  note: note.trim() || null,
                }),
              },
            );
            const data = (await response.json()) as {
              error?: { message?: string };
            };
            if (!response.ok) {
              setError(
                data.error?.message ?? "Could not submit demo payment.",
              );
              return;
            }
            setSuccess(
              "Demo payment submitted for coordinator confirmation. This is not a real payment provider success.",
            );
            router.refresh();
          });
        }}
      >
        {pending ? "Submitting…" : "Submit demo / simulate payment"}
      </button>
    </section>
  );
}
