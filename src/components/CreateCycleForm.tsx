"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type CreateCycleFormProps = {
  communityId: string;
};

export function CreateCycleForm({ communityId }: CreateCycleFormProps) {
  const router = useRouter();
  const [name, setName] = useState("Autumn 2026");
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
              body: JSON.stringify({ name }),
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
      <h2 className="type-h3">Create a financial cycle</h2>
      <p className="type-caption">
        Expenses and allocations require an open cycle. Dates and commitments are
        not assumed for you.
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
      {error ? (
        <p role="alert" className="flex gap-2 text-sm text-danger">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="focus-ring rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create open cycle"}
      </button>
    </form>
  );
}
