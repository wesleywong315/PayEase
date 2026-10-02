"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function CreateCommunityForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="card-surface space-y-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const response = await fetch("/api/communities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              description: description.trim() || null,
            }),
          });
          const data = (await response.json()) as {
            community?: { id: string };
            error?: { message?: string };
          };
          if (!response.ok || !data.community) {
            setError(data.error?.message ?? "Could not create community.");
            return;
          }
          router.push(
            `/communities/${data.community.id}/invitations?created=1`,
          );
          router.refresh();
        });
      }}
    >
      <div className="space-y-2">
        <label htmlFor="community-name" className="type-caption font-semibold text-ink">
          Community name
        </label>
        <input
          id="community-name"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink"
          placeholder="HKU Hall Football Team"
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="community-description"
          className="type-caption font-semibold text-ink"
        >
          Description (optional)
        </label>
        <textarea
          id="community-description"
          maxLength={500}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink"
          placeholder="Short context for people joining via invitation."
        />
      </div>
      {error ? (
        <p role="alert" className="flex gap-2 text-sm text-danger">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="focus-ring rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create community"}
      </button>
      <p className="type-caption">
        You will become the coordinator. Create a financial cycle before
        committing expenses.
      </p>
    </form>
  );
}
