"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={`focus-ring rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink transition hover:border-primary hover:text-primary disabled:opacity-60 ${className}`}
      onClick={() => {
        startTransition(async () => {
          await fetch("/api/session", { method: "DELETE" });
          router.replace("/login");
          router.refresh();
        });
      }}
    >
      {pending ? "Signing out…" : "Log out"}
    </button>
  );
}
