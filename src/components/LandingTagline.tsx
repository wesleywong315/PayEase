"use client";

import { useEffect, useState } from "react";

const GROUPS = [
  "Sports teams",
  "Debate teams",
  "Band Teams",
  "Societies",
  "Interest Groups",
] as const;

const INTERVAL_MS = 2600;

export function LandingTagline() {
  const [index, setIndex] = useState(0);
  const [outgoing, setOutgoing] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    let swapTimer: number | undefined;
    const id = window.setInterval(() => {
      setOutgoing(true);
      swapTimer = window.setTimeout(() => {
        setIndex((i) => (i + 1) % GROUPS.length);
        setOutgoing(false);
      }, 280);
    }, INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      if (swapTimer !== undefined) window.clearTimeout(swapTimer);
    };
  }, []);

  return (
    <p className="max-w-xl text-lg text-[#f3efe6]/90 sm:text-xl">
      Fair financial tracking for{" "}
      <span className="landing-rotator" aria-live="polite">
        <span
          key={index}
          className={
            outgoing ? "landing-rotator-word is-out" : "landing-rotator-word"
          }
        >
          {GROUPS[index]}
        </span>
      </span>
    </p>
  );
}
