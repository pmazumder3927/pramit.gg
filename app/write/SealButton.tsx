"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The seal: press and hold, and the stamp fills with rust ink from the bottom;
// let go early and the ink drains back out. Holding it full presses the page.
// The hold IS the anticipation — and the accident-prevention.
export default function SealButton({
  label,
  holdMs = 800,
  disabled = false,
  busy = false,
  onSealed,
  onRefused,
}: {
  label: string;
  holdMs?: number;
  disabled?: boolean;
  busy?: boolean;
  onSealed: () => void;
  onRefused?: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const sealedRef = useRef(false);

  const stop = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setHolding(false);
  }, []);

  const start = useCallback(() => {
    if (busy || sealedRef.current) return;
    if (disabled) {
      onRefused?.();
      return;
    }
    setHolding(true);
    timer.current = window.setTimeout(() => {
      sealedRef.current = true;
      setHolding(false);
      onSealed();
      // re-arm in case the parent keeps the verso open after a failure
      window.setTimeout(() => {
        sealedRef.current = false;
      }, 1200);
    }, holdMs);
  }, [busy, disabled, holdMs, onRefused, onSealed]);

  useEffect(() => stop, [stop]);

  return (
    <button
      type="button"
      aria-label={`${label} — press and hold`}
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter" || e.key === " ") stop();
      }}
      className={`relative inline-flex min-h-[44px] select-none items-center justify-center overflow-hidden rounded-[6px] border-[1.8px] px-6 py-2.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.2em] transition-colors ${
        disabled
          ? "border-line text-ink-faint"
          : "border-accent-rust text-accent-rust"
      }`}
      style={{ touchAction: "none" }}
    >
      {/* the ink, rising from the foot of the stamp */}
      <span
        aria-hidden
        className="absolute inset-0 origin-bottom bg-accent-rust"
        style={{
          transform: holding ? "scaleY(1)" : "scaleY(0)",
          transition: holding
            ? `transform ${holdMs}ms linear`
            : "transform 220ms ease-out",
        }}
      />
      <span
        className={`relative transition-colors duration-200 ${
          holding ? "text-pure-white delay-150" : ""
        }`}
      >
        {busy ? "pressing…" : label}
      </span>
    </button>
  );
}
