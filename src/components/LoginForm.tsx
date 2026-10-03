"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { DEMO_PASSWORD } from "@/lib/demo-auth";

type DemoUser = {
  id: string;
  displayName: string;
  username: string;
  email: string | null;
  roleLabels: string[];
};

type LoginFormProps = {
  users: DemoUser[];
  nextPath: string;
};

type Mode = "password" | "demo" | "register";

export function LoginForm({ users, nextPath }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function finishLogin(response: Response, data: { next?: string; error?: { message?: string } }) {
    if (!response.ok) {
      setError(data.error?.message ?? "Could not sign in.");
      return;
    }
    router.replace(data.next ?? "/profile/communities");
    router.refresh();
  }

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "password",
          username,
          password,
          next: nextPath,
        }),
      });
      const data = (await response.json()) as {
        next?: string;
        error?: { message?: string };
      };
      finishLogin(response, data);
    });
  }

  function loginAsDemo(userId: string) {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "demo", userId, next: nextPath }),
      });
      const data = (await response.json()) as {
        next?: string;
        error?: { message?: string };
      };
      finishLogin(response, data);
    });
  }

  function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    startTransition(async () => {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          username,
          password,
          displayName,
          next: nextPath,
        }),
      });
      const data = (await response.json()) as {
        next?: string;
        error?: { message?: string };
      };
      finishLogin(response, data);
    });
  }

  return (
    <div className="space-y-6">
      {error ? <ErrorAlert message={error} /> : null}

      {mode === "password" ? (
        <form onSubmit={submitPassword} className="card-surface space-y-4 p-5">
          <div>
            <label htmlFor="login-username" className="type-caption font-semibold text-ink">
              Username
            </label>
            <input
              id="login-username"
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="focus-ring mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-ink"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="type-caption font-semibold text-ink">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-ring mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-ink"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="focus-ring w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Log in"}
          </button>
        </form>
      ) : null}

      {mode === "register" ? (
        <form onSubmit={submitRegister} className="card-surface space-y-4 p-5">
          <p className="type-caption">
            Creates a fresh account with no communities. You can create or join
            communities after signing in.
          </p>
          <div>
            <label htmlFor="reg-display" className="type-caption font-semibold text-ink">
              Display name
            </label>
            <input
              id="reg-display"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="focus-ring mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-ink"
            />
          </div>
          <div>
            <label htmlFor="reg-username" className="type-caption font-semibold text-ink">
              Username
            </label>
            <input
              id="reg-username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="focus-ring mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-ink"
            />
          </div>
          <div>
            <label htmlFor="reg-password" className="type-caption font-semibold text-ink">
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-ring mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-ink"
            />
          </div>
          <div>
            <label htmlFor="reg-confirm" className="type-caption font-semibold text-ink">
              Confirm password
            </label>
            <input
              id="reg-confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="focus-ring mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-ink"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="focus-ring w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create account"}
          </button>
          <button
            type="button"
            className="focus-ring w-full text-sm font-semibold text-primary"
            onClick={() => {
              setError(null);
              setMode("demo");
            }}
          >
            Back to demo accounts
          </button>
        </form>
      ) : null}

      {mode === "demo" ? (
        <div className="space-y-4">
          <p className="type-caption rounded-xl border border-border bg-surface px-4 py-3">
            Seeded hackathon users. Password for all demo accounts:{" "}
            <span className="font-mono text-ink">{DEMO_PASSWORD}</span>
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {users.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => loginAsDemo(user.id)}
                  className="card-surface focus-ring flex w-full flex-col items-start gap-2 p-4 text-left transition hover:border-primary disabled:opacity-60"
                >
                  <span className="type-h3">{user.displayName}</span>
                  <span className="type-caption">@{user.username}</span>
                  <span className="type-caption text-primary">
                    {user.roleLabels.length > 0
                      ? user.roleLabels.join(" · ")
                      : "No communities yet"}
                  </span>
                  <span className="mt-2 text-sm font-semibold text-primary">
                    Continue as {user.displayName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setUsername("");
              setPassword("");
              setConfirmPassword("");
              setDisplayName("");
              setMode("register");
            }}
            className="focus-ring w-full rounded-full border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink hover:border-primary hover:text-primary"
          >
            Create a new account
          </button>
          <button
            type="button"
            className="focus-ring w-full text-sm font-semibold text-primary"
            onClick={() => {
              setError(null);
              setMode("password");
            }}
          >
            Back to username / password
          </button>
        </div>
      ) : null}

      {mode === "password" ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode("demo");
          }}
          className="focus-ring w-full rounded-full border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink hover:border-primary hover:text-primary"
        >
          Demo accounts
        </button>
      ) : null}

      <p className="type-caption rounded-xl border border-border bg-surface px-4 py-3">
        Hackathon prototype auth — not production-grade security. Sessions use a
        signed cookie.
      </p>
    </div>
  );
}
