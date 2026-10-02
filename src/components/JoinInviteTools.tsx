"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useRouter } from "next/navigation";

function extractToken(raw: string): string | null {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed, window.location.origin);
    const parts = url.pathname.split("/").filter(Boolean);
    const joinIndex = parts.indexOf("join");
    if (joinIndex >= 0 && parts[joinIndex + 1]) {
      return parts[joinIndex + 1]!;
    }
  } catch {
    // not a URL
  }
  if (/^[A-Za-z0-9_-]{16,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function JoinInviteTools() {
  const router = useRouter();
  const [pasteValue, setPasteValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "payease-qr-reader";

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        void scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            scanner.clear();
            scannerRef.current = null;
          });
      }
    };
  }, []);

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (!scanner) {
      setScanning(false);
      return;
    }
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // ignore camera stop errors
    } finally {
      scannerRef.current = null;
      setScanning(false);
    }
  }

  async function startScanner() {
    setError(null);
    setScanning(true);
    try {
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          const token = extractToken(decoded);
          if (!token) {
            setError("QR code did not contain a PayEase invitation link.");
            return;
          }
          await stopScanner();
          router.push(`/join/${token}`);
        },
        () => undefined,
      );
    } catch {
      setScanning(false);
      setError(
        "Camera unavailable or permission denied. Paste an invitation link instead.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="card-surface space-y-3 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const token = extractToken(pasteValue);
          if (!token) {
            setError("Enter a valid /join/… link or invitation token.");
            return;
          }
          setError(null);
          router.push(`/join/${token}`);
        }}
      >
        <label htmlFor="invite-paste" className="type-caption font-semibold text-ink">
          Paste invitation link or token
        </label>
        <input
          id="invite-paste"
          value={pasteValue}
          onChange={(e) => setPasteValue(e.target.value)}
          placeholder="/join/opaque-token"
          className="focus-ring w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm"
        />
        <button
          type="submit"
          className="focus-ring rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Continue to confirmation
        </button>
      </form>

      <div className="card-surface space-y-3 p-5">
        <h2 className="type-h3">Scan QR code</h2>
        <p className="type-caption">
          Camera access is requested only after you press Scan. Frames stay on
          this device and are not uploaded.
        </p>
        <div className="flex flex-wrap gap-2">
          {!scanning ? (
            <button
              type="button"
              className="focus-ring rounded-full border border-border px-4 py-2 text-sm font-semibold"
              onClick={() => void startScanner()}
            >
              Scan
            </button>
          ) : (
            <button
              type="button"
              className="focus-ring rounded-full border border-border px-4 py-2 text-sm font-semibold"
              onClick={() => void stopScanner()}
            >
              Stop camera
            </button>
          )}
        </div>
        <div id={regionId} className="overflow-hidden rounded-xl" />
      </div>

      {error ? (
        <p role="alert" className="flex gap-2 text-sm text-danger">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
