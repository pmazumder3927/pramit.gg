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
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-light text-white mb-4">
          something went wrong
        </h2>
        <p className="text-gray-400 mb-8 max-w-md">
          an unexpected error occurred. please try again or return home.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-accent-orange text-black rounded-lg hover:bg-opacity-90 transition-all"
          >
            try again
          </button>
          <Link
            href="/"
            className="px-6 py-3 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-all"
          >
            go home
          </Link>
        </div>
      </div>
    </div>
  );
}
