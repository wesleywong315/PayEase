"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";

export function CloseCycleButton({ communityId }: { communityId: string }) {
  const router = useRouter();
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="card-surface space-y-3 p-5">
      <h2 className="type-h3">Close cycle</h2>
      <p className="type-caption">
        Requires no drafts, pending PayAid requests, or proposed rules.
        Outstanding balances stay unpaid unless you settle them first.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="focus-ring"
        />
        Acknowledge outstanding contribution/reimbursement balances if any remain
      </label>
      {error ? <ErrorAlert message={error} /> : null}
      <button
        type="button"
        disabled={pending}
        className="focus-ring rounded-full border border-danger/40 px-5 py-2.5 text-sm font-semibold text-danger disabled:opacity-60"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const response = await fetch(
              `/api/communities/${communityId}/cycles`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "close",
                  acknowledgeOutstandingBalances: ack,
                }),
              },
            );
            const data = (await response.json()) as {
              error?: { message?: string };
            };
            if (!response.ok) {
              setError(data.error?.message ?? "Could not close cycle.");
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Closing…" : "Close cycle"}
      </button>
    </div>
  );
}
