"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type MarkUpdateReadButtonProps = {
  communityId: string;
  notificationId: string;
};

export function MarkUpdateReadButton({
  communityId,
  notificationId,
}: MarkUpdateReadButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="focus-ring rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
      onClick={() => {
        startTransition(async () => {
          await fetch(`/api/communities/${communityId}/updates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notificationId }),
          });
          router.refresh();
        });
      }}
    >
      {pending ? "Marking…" : "Mark read"}
    </button>
  );
}
