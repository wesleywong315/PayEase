"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";

type CreateCycleFormProps = {
  communityId: string;
};

function defaultEndDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

export function CreateCycleForm({ communityId }: CreateCycleFormProps) {
  const router = useRouter();
  const [name, setName] = useState("Autumn 2026");
  const [endsAt, setEndsAt] = useState(defaultEndDate);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="card-surface space-y-3 border-warning/40 bg-warning-bg/40 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const response = await fetch(
            `/api/communities/${communityId}/cycles`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, endsAt }),
            },
          );
          const data = (await response.json()) as {
            error?: { message?: string };
          };
          if (!response.ok) {
            setError(data.error?.message ?? "Could not create cycle.");
            return;
          }
          router.refresh();
        });
      }}
    >
      <h2 className="type-h3">Open a financial cycle</h2>
      <p className="type-caption">
        Set a clear end date. Expenses and settlements for this community run
        inside this cycle until it closes.
      </p>
      <label htmlFor="cycle-name" className="type-caption font-semibold text-ink">
        Cycle name
      </label>
      <input
        id="cycle-name"
        required
        minLength={2}
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="focus-ring w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
      />
      <label htmlFor="cycle-ends" className="type-caption font-semibold text-ink">
        Cycle end date
      </label>
      <input
        id="cycle-ends"
        type="date"
        required
        value={endsAt}
        onChange={(e) => setEndsAt(e.target.value)}
        className="focus-ring w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm sm:max-w-xs"
      />
      {error ? <ErrorAlert message={error} /> : null}
      <button
        type="submit"
        disabled={pending}
        className="focus-ring rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Opening…" : "Open cycle"}
      </button>
    </form>
  );
}
