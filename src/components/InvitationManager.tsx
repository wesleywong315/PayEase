"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import QRCode from "qrcode";

type InvitationRow = {
  id: string;
  token: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  path: string;
};

type InvitationManagerProps = {
  communityId: string;
  communityName: string;
};

function absoluteInviteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function InvitationManager({
  communityId,
  communityName,
}: InvitationManagerProps) {
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const response = await fetch(`/api/communities/${communityId}/invitations`);
    const data = (await response.json()) as {
      invitations?: InvitationRow[];
      error?: { message?: string };
    };
    if (!response.ok) {
      setError(data.error?.message ?? "Could not load invitations.");
      return;
    }
    setInvitations(data.invitations ?? []);
    const active = (data.invitations ?? []).find((row) => row.status === "ACTIVE");
    if (active) {
      setSelectedPath(active.path);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  useEffect(() => {
    if (!selectedPath) {
      setQrDataUrl(null);
      return;
    }
    const url = absoluteInviteUrl(selectedPath);
    void QRCode.toDataURL(url, {
      margin: 1,
      width: 240,
      color: { dark: "#103b2f", light: "#fffcf7" },
    }).then(setQrDataUrl);
  }, [selectedPath]);

  const selected = useMemo(
    () => invitations.find((row) => row.path === selectedPath) ?? null,
    [invitations, selectedPath],
  );

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="flex gap-2 text-sm text-danger">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          className="focus-ring rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const response = await fetch(
                `/api/communities/${communityId}/invitations`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ttlDays: 7 }),
                },
              );
              const data = (await response.json()) as {
                invitation?: InvitationRow;
                error?: { message?: string };
              };
              if (!response.ok || !data.invitation) {
                setError(data.error?.message ?? "Could not create invitation.");
                return;
              }
              await refresh();
              setSelectedPath(data.invitation.path);
            });
          }}
        >
          {pending ? "Working…" : "Generate invitation (7 days)"}
        </button>
      </div>

      {selected && qrDataUrl ? (
        <section className="card-surface grid gap-4 p-5 sm:grid-cols-[240px_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`QR code invitation for ${communityName}`}
            className="rounded-xl border border-border bg-surface"
            width={240}
            height={240}
          />
          <div className="space-y-3">
            <h2 className="type-h3">Share invitation</h2>
            <p className="type-caption">
              Status: <strong>{selected.status}</strong>
              {" · "}
              Expires {new Date(selected.expiresAt).toISOString().slice(0, 10)}
            </p>
            <p className="break-all rounded-xl border border-border bg-canvas px-3 py-2 font-mono text-xs text-ink">
              {absoluteInviteUrl(selected.path)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="focus-ring rounded-full border border-border px-4 py-2 text-sm font-semibold"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    absoluteInviteUrl(selected.path),
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={qrDataUrl}
                download={`${communityName.replace(/\s+/g, "-").toLowerCase()}-invite.png`}
                className="focus-ring rounded-full border border-border px-4 py-2 text-sm font-semibold"
              >
                Download QR
              </a>
              {selected.status === "ACTIVE" ? (
                <button
                  type="button"
                  className="focus-ring rounded-full border border-danger/40 px-4 py-2 text-sm font-semibold text-danger"
                  onClick={() => {
                    startTransition(async () => {
                      await fetch(
                        `/api/communities/${communityId}/invitations/${selected.id}/revoke`,
                        { method: "POST" },
                      );
                      await refresh();
                    });
                  }}
                >
                  Revoke
                </button>
              ) : null}
            </div>
            <p className="type-caption">
              QR codes encode only the invitation URL. No financial or personal
              data is embedded. New joiners receive the Member role only.
            </p>
          </div>
        </section>
      ) : (
        <p className="type-caption">
          Generate an invitation to show a QR code and shareable link.
        </p>
      )}

      <section className="space-y-2">
        <h2 className="type-h3">Recent invitations</h2>
        <ul className="card-surface divide-y divide-border">
          {invitations.length === 0 ? (
            <li className="px-4 py-3 type-caption">No invitations yet.</li>
          ) : (
            invitations.map((invite) => (
              <li key={invite.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-canvas/70"
                  onClick={() => setSelectedPath(invite.path)}
                >
                  <span className="font-mono text-xs">{invite.token.slice(0, 10)}…</span>
                  <span className="type-caption">{invite.status}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
