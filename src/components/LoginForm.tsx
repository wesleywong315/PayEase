"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type DemoUser = {
  id: string;
  displayName: string;
  email: string | null;
  roleLabels: string[];
};

type LoginFormProps = {
  users: DemoUser[];
  nextPath: string;
};

export function LoginForm({ users, nextPath }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loginAs(userId: string) {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, next: nextPath }),
      });

      const data = (await response.json()) as {
        next?: string;
        error?: { message?: string };
      };

      if (!response.ok) {
        setError(data.error?.message ?? "Could not sign in.");
        return;
      }

      router.replace(data.next ?? "/communities");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {users.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => loginAs(user.id)}
              className="card-surface focus-ring flex w-full flex-col items-start gap-2 p-4 text-left transition hover:border-primary disabled:opacity-60"
            >
              <span className="type-h3">{user.displayName}</span>
              <span className="type-caption">{user.email ?? "No email"}</span>
              <span className="type-caption text-primary">
                {user.roleLabels.join(" · ")}
              </span>
              <span className="mt-2 text-sm font-semibold text-primary">
                Continue as {user.displayName}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="type-caption rounded-xl border border-border bg-surface px-4 py-3">
        Demo authentication only — not production-grade login security. Sessions
        are simulated with a signed cookie.
      </p>
    </div>
  );
}
