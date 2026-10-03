"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { parseHkdToCents } from "@/lib/money";

type MemberOption = { id: string; displayName: string };

export function SettlementCashForm({
  communityId,
  members,
}: {
  communityId: string;
  members: MemberOption[];
}) {
  const router = useRouter();
  const [type, setType] = useState<"PAYER_REIMBURSEMENT" | "MEMBER_CONTRIBUTION">(
    "PAYER_REIMBURSEMENT",
  );
  const [membershipId, setMembershipId] = useState(members[0]?.id ?? "");
  const [amountHkd, setAmountHkd] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (members.length === 0) return null;

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
          const response = await fetch(`/api/communities/${communityId}/cash`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type,
              membershipId,
              amountCents,
              note: note.trim() || null,
              idempotencyKey: `cash-${crypto.randomUUID()}`,
            }),
          });
          const data = (await response.json()) as { error?: { message?: string } };
          if (!response.ok) {
            setError(data.error?.message ?? "Could not record cash.");
            return;
          }
          setAmountHkd("");
          setNote("");
          router.refresh();
        });
      }}
    >
      <h2 className="type-h3">Record treasurer cash</h2>
      <p className="type-caption">
        Tracking only — manually confirmed, not bank verified. Refunds are not
        available.
      </p>
      <select
        value={type}
        onChange={(e) =>
          setType(e.target.value as "PAYER_REIMBURSEMENT" | "MEMBER_CONTRIBUTION")
        }
        className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm sm:max-w-md"
      >
        <option value="PAYER_REIMBURSEMENT">Payer reimbursement</option>
        <option value="MEMBER_CONTRIBUTION">Member contribution (coordinator record)</option>
      </select>
      <select
        value={membershipId}
        onChange={(e) => setMembershipId(e.target.value)}
        className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm sm:max-w-md"
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.displayName}
          </option>
        ))}
      </select>
      <input
        inputMode="decimal"
        required
        value={amountHkd}
        onChange={(e) => setAmountHkd(e.target.value)}
        className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 font-mono text-sm sm:max-w-xs"
        placeholder="0.00"
        aria-label="Amount HKD"
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
        {pending ? "Saving…" : "Record"}
      </button>
    </form>
  );
}
