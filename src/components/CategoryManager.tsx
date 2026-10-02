"use client";

import { useEffect, useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { StatusBadge } from "@/components/StatusBadge";

type CategoryRow = {
  id: string;
  name: string;
  archivedAt: string | null;
};

type CategoryManagerProps = {
  communityId: string;
  initialCategories?: CategoryRow[];
  /** expense (default) or credit — separate category namespaces */
  kind?: "expense" | "credit";
};

export function CategoryManager({
  communityId,
  initialCategories = [],
  kind = "expense",
}: CategoryManagerProps) {
  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const basePath =
    kind === "credit"
      ? `/api/communities/${communityId}/credit-categories`
      : `/api/communities/${communityId}/categories`;
  const heading = kind === "credit" ? "Credit categories" : "Categories";
  const caption =
    kind === "credit"
      ? "Reusable labels for grants and subsidies. Archive instead of deleting."
      : "Reusable labels for expenses. Archive instead of deleting.";

  async function refresh() {
    const response = await fetch(`${basePath}?includeArchived=1`);
    const data = (await response.json()) as {
      categories?: CategoryRow[];
      error?: { message?: string };
    };
    if (!response.ok) {
      setError(data.error?.message ?? "Could not load categories.");
      return;
    }
    setCategories(data.categories ?? []);
  }

  useEffect(() => {
    if (initialCategories.length === 0) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, kind]);

  return (
    <section className="card-surface space-y-4 p-5" aria-labelledby="categories-heading">
      <div>
        <h2 id="categories-heading" className="type-h3">
          {heading}
        </h2>
        <p className="type-caption mt-1">{caption}</p>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const response = await fetch(basePath, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            });
            const data = (await response.json()) as {
              error?: { message?: string };
            };
            if (!response.ok) {
              setError(data.error?.message ?? "Could not create category.");
              return;
            }
            setName("");
            await refresh();
          });
        }}
      >
        <input
          required
          minLength={1}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          className="focus-ring min-w-[12rem] flex-1 rounded-xl border border-border bg-canvas px-4 py-2.5 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={pending}
          className="focus-ring rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>

      {error ? <ErrorAlert message={error} /> : null}

      <ul className="divide-y divide-border rounded-xl border border-border">
        {categories.length === 0 ? (
          <li className="px-4 py-3 type-caption">No categories yet.</li>
        ) : (
          categories.map((cat) => (
            <li
              key={cat.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">{cat.name}</span>
                {cat.archivedAt ? <StatusBadge status="ARCHIVED" /> : null}
              </div>
              {!cat.archivedAt ? (
                <button
                  type="button"
                  disabled={pending}
                  className="focus-ring rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-danger disabled:opacity-60"
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      const response = await fetch(
                        `${basePath}/${cat.id}/archive`,
                        { method: "POST" },
                      );
                      const data = (await response.json()) as {
                        error?: { message?: string };
                      };
                      if (!response.ok) {
                        setError(
                          data.error?.message ?? "Could not archive category.",
                        );
                        return;
                      }
                      await refresh();
                    });
                  }}
                >
                  Archive
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
