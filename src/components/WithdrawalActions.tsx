"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { MoneyText } from "@/components/MoneyText";
import type { WithdrawalPreview } from "@/server/services/withdrawals";

export function WithdrawalActions({
  communityId,
  membershipId,
  cycleRevision,
  isCoordinator,
}: {
  communityId: string;
  membershipId: string;
  cycleRevision: number;
  isCoordinator: boolean;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<WithdrawalPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: "preview" | "execute") {
    setError(null);
    startTransition(async () => {
      const response = await fetch(
        `/api/communities/${communityId}/memberships/${membershipId}/withdrawal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, cycleRevision }),
        },
      );
      const data = (await response.json()) as {
        preview?: WithdrawalPreview;
        error?: { message?: string };
      };
      if (!response.ok) {
        setError(data.error?.message ?? "Could not run withdrawal.");
        return;
      }
      if (data.preview) setPreview(data.preview);
      if (action === "execute") router.refresh();
    });
  }

  return (
    <div className="card-surface space-y-3 p-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="focus-ring rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60"
          onClick={() => run("preview")}
        >
          Preview impact
        </button>
        {isCoordinator ? (
          <button
            type="button"
            disabled={pending}
            className="focus-ring rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => run("execute")}
          >
            Execute leave
          </button>
        ) : null}
      </div>
      {error ? <ErrorAlert message={error} /> : null}
      {preview ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="type-caption">Committed remaining</dt>
            <dd>
              <MoneyText cents={preview.committedFinalChargeCents} />
            </dd>
          </div>
          <div>
            <dt className="type-caption">Contribution outstanding</dt>
            <dd>
              <MoneyText cents={preview.contributionOutstandingCents} />
            </dd>
          </div>
          <div>
            <dt className="type-caption">Reimbursement outstanding</dt>
            <dd>
              <MoneyText cents={preview.reimbursementOutstandingCents} />
            </dd>
          </div>
          <div>
            <dt className="type-caption">Drafts released</dt>
            <dd>{preview.draftsReleased.length}</dd>
          </div>
          {preview.draftsNeedingRevision.length > 0 ? (
            <p className="sm:col-span-2 type-caption text-warning">
              {preview.draftsNeedingRevision.length} draft(s) would need revision
              (no participants left).
            </p>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
