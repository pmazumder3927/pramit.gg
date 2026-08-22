"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROOMS = [
  { href: "/music/manage", label: "the desk", exact: true },
  { href: "/music/manage/sort", label: "sorting", exact: false },
  { href: "/music/manage/graveyard", label: "graveyard", exact: false },
];

/**
 * A thin ruled header, the way /write does it — the workbench should get out of
 * the way. The site's own nav already sits above this, so a second heavy bar
 * would just be chrome stacked on chrome.
 */
export function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onPlaylist = pathname.includes("/music/manage/playlist/");

  return (
    <div className="min-h-screen page-reveal">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-[2px]">
        <div className="mx-auto flex max-w-5xl items-baseline gap-5 px-4 py-2.5 sm:px-6">
          <Link
            href="/music/manage"
            className="font-hand text-lg leading-none text-accent-rust transition-opacity hover:opacity-70"
          >
            it&rsquo;s 3am
          </Link>

          <nav className="flex items-baseline gap-4">
            {ROOMS.map((room) => {
              const active = room.exact
                ? pathname === room.href
                : pathname.startsWith(room.href);
              return (
                <Link
                  key={room.href}
                  href={room.href}
                  className={`relative font-mono text-[11px] lowercase tracking-wide transition-colors ${
                    active ? "text-ink" : "text-ink-faint hover:text-ink-soft"
                  }`}
                >
                  {room.label}
                  {active && (
                    <svg
                      className="pointer-events-none absolute -bottom-1.5 left-0 w-full"
                      height="4"
                      viewBox="0 0 100 4"
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      <path
                        d="M1 2.6 Q 26 0.6 50 2.2 T 99 1.6"
                        fill="none"
                        stroke="rgb(var(--accent-orange))"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </Link>
              );
            })}
            {onPlaylist && (
              <span className="font-mono text-[11px] lowercase tracking-wide text-accent-purple">
                / setlist
              </span>
            )}
          </nav>

          <div className="ml-auto flex items-baseline gap-4">
            <Link
              href="/music"
              className="font-mono text-[11px] lowercase tracking-wide text-ink-faint transition-colors hover:text-ink-soft"
            >
              public
            </Link>
            <Link
              href="/dashboard"
              className="font-mono text-[11px] lowercase tracking-wide text-ink-faint transition-colors hover:text-ink-soft"
            >
              dashboard
            </Link>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
