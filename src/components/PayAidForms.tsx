"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { parseHkdToCents } from "@/lib/money";

export function PayAidFundingForm({ communityId }: { communityId: string }) {
  const router = useRouter();
  const [amountHkd, setAmountHkd] = useState("");
  const [kind, setKind] = useState<"RECEIVED" | "PLEDGED">("RECEIVED");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="card-surface space-y-3 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const amountCents = parseHkdToCents(amountHkd);
          if (amountCents === null || amountCents <= 0) {
            setError("Enter a valid positive HKD amount.");
            return;
          }
          const response = await fetch(
            `/api/communities/${communityId}/payaid/funding`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amountCents,
                kind,
                note: note.trim() || null,
                idempotencyKey: `payaid-${crypto.randomUUID()}`,
              }),
            },
          );
          const data = (await response.json()) as { error?: { message?: string } };
          if (!response.ok) {
            setError(data.error?.message ?? "Could not record funding.");
            return;
          }
          setAmountHkd("");
          setNote("");
          router.refresh();
        });
      }}
    >
      <h3 className="type-h3">Record PayAid funding</h3>
      <p className="type-caption">
        Received funding is spendable. Pledges are visible but not spendable.
      </p>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          <input
            type="radio"
            checked={kind === "RECEIVED"}
            onChange={() => setKind("RECEIVED")}
            className="mr-1"
          />
          Received
        </label>
        <label className="text-sm">
          <input
            type="radio"
            checked={kind === "PLEDGED"}
            onChange={() => setKind("PLEDGED")}
            className="mr-1"
          />
          Pledged
        </label>
      </div>
      <input
        inputMode="decimal"
        required
        value={amountHkd}
        onChange={(e) => setAmountHkd(e.target.value)}
        className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 font-mono text-sm sm:max-w-xs"
        placeholder="0.00"
        aria-label="Funding amount HKD"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm"
        placeholder="Note (optional)"
      />
      {error ? <ErrorAlert message={error} /> : null}
      <button
        type="submit"
        disabled={pending}
        className="focus-ring rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Record funding"}
      </button>
    </form>
  );
}

export function PayAidCapRequestForm({ communityId }: { communityId: string }) {
  const router = useRouter();
  const [capHkd, setCapHkd] = useState("");
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="card-surface space-y-3 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const requestedCapCents = parseHkdToCents(capHkd);
          if (requestedCapCents === null) {
            setError("Enter a valid HKD cap (0 is allowed).");
            return;
          }
          const response = await fetch(
            `/api/communities/${communityId}/payaid/caps`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requestedCapCents,
                explanation,
              }),
            },
          );
          const data = (await response.json()) as { error?: { message?: string } };
          if (!response.ok) {
            setError(data.error?.message ?? "Could not submit request.");
            return;
          }
          setCapHkd("");
          setExplanation("");
          router.refresh();
        });
      }}
    >
      <h3 className="type-h3">Request a contribution cap</h3>
      <p className="type-caption">
        Private to you and coordinators. Approved support comes only from the
        funded PayAid pool.
      </p>
      <input
        inputMode="decimal"
        required
        value={capHkd}
        onChange={(e) => setCapHkd(e.target.value)}
        className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 font-mono text-sm sm:max-w-xs"
        placeholder="Cap HKD"
        aria-label="Requested cap HKD"
      />
      <textarea
        required
        minLength={8}
        rows={3}
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm"
        placeholder="Short explanation"
      />
      {error ? <ErrorAlert message={error} /> : null}
      <button
        type="submit"
        disabled={pending}
        className="focus-ring rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}

export function PayAidDecideButtons({
  communityId,
  requestId,
}: {
  communityId: string;
  requestId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(decision: "APPROVE" | "REJECT") {
    setError(null);
    startTransition(async () => {
      const response = await fetch(
        `/api/communities/${communityId}/payaid/caps/${requestId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            rejectionReason: decision === "REJECT" ? "Rejected by coordinator" : null,
          }),
        },
      );
      const data = (await response.json()) as {
        error?: { message?: string; details?: { shortfallCents?: number } };
      };
      if (!response.ok) {
        setError(data.error?.message ?? "Could not decide request.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="focus-ring rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => decide("APPROVE")}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          className="focus-ring rounded-full border border-danger/40 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
          onClick={() => decide("REJECT")}
        >
          Reject
        </button>
      </div>
      {error ? <ErrorAlert message={error} /> : null}
    </div>
  );
}
