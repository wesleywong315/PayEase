"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";

type CommitExpenseButtonProps = {
  communityId: string;
  expenseId: string;
  cycleRevision: number;
};

export function CommitExpenseButton({
  communityId,
  expenseId,
  cycleRevision,
}: CommitExpenseButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        className="focus-ring rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const response = await fetch(
              `/api/communities/${communityId}/expenses/${expenseId}/commit`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cycleRevision }),
              },
            );
            const data = (await response.json()) as {
              error?: { message?: string };
            };
            if (!response.ok) {
              setError(data.error?.message ?? "Could not commit expense.");
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Committing…" : "Commit expense"}
      </button>
      {error ? <ErrorAlert message={error} /> : null}
      <p className="type-caption">
        Committing stores allocations and makes the expense payable. Drafts can
        still be revised until then.
      </p>
    </div>
  );
}
