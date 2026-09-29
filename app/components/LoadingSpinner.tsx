"use client";

interface LoadingSpinnerProps {
  isLoading?: boolean;
  fullscreen?: boolean;
  className?: string;
}

export default function LoadingSpinner({
  isLoading = true,
  fullscreen = false,
  className = "",
}: LoadingSpinnerProps) {
  if (!isLoading) return null;

  return (
    <div
      role="status"
      className={`${fullscreen ? "fixed inset-0 z-50 bg-paper/95" : "relative py-8"} flex items-center justify-center gap-3 ${className}`}
    >
      <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent-rust motion-reduce:animate-none" />
      <span className="font-hand text-xl text-ink-soft">loading…</span>
    </div>
  );
}
