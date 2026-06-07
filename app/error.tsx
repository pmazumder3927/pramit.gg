"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <span className="font-hand text-3xl -rotate-2 text-accent-rust">oops —</span>
        <h2 className="mt-1 font-serif text-3xl font-medium text-ink mb-4">
          a smudge in the ink
        </h2>
        <p className="text-ink-soft mb-8 max-w-md mx-auto">
          an unexpected error occurred. please try again or return home.
        </p>
        <div className="flex gap-4 justify-center">
          <button onClick={reset} className="btn-sketch btn-sketch-solid">
            try again
          </button>
          <Link href="/" className="btn-sketch">
            go home
          </Link>
        </div>
      </div>
    </div>
  );
}
