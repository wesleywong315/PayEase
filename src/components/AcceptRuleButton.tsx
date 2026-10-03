"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";

export function AcceptRuleButton({
  communityId,
  ruleId,
}: {
  communityId: string;
  ruleId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        className="focus-ring rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const response = await fetch(
              `/api/communities/${communityId}/rules/${ruleId}/accept`,
              { method: "POST" },
            );
            const data = (await response.json()) as {
              error?: { message?: string };
            };
            if (!response.ok) {
              setError(data.error?.message ?? "Could not accept rule.");
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Accepting…" : "Accept this rule"}
      </button>
      {error ? <ErrorAlert message={error} /> : null}
    </div>
  );
}
