import Link from "next/link";
import NotFoundTracker from "@/app/components/NotFoundTracker";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <NotFoundTracker />
      <div className="text-center">
        <h2 className="font-serif text-7xl md:text-8xl font-medium text-ink mb-2">404</h2>
        <h3 className="font-hand text-3xl -rotate-1 text-accent-purple mb-4">this page wandered off</h3>
        <p className="text-ink-soft mb-8 max-w-md mx-auto">
          this page don&apos;t exist
        </p>
        <Link href="/" className="btn-sketch btn-sketch-solid">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          back to home
        </Link>
      </div>
    </div>
  );
}
