"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

const NAV_ITEMS = [
  { href: "/music/manage", label: "Overview", match: "/music/manage" },
  { href: "/music/manage/review", label: "Review", match: "/music/manage/review" },
  { href: "/music/manage/status", label: "Status", match: "/music/manage/status" },
];

function isActive(pathname: string, href: string, match: string) {
  if (href === "/music/manage") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${match}/`);
}

export function MusicManagerShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isOverview = pathname === "/music/manage";

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black page-reveal">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(255,107,61,0.08),transparent_30%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_88%_14%,rgba(124,119,198,0.08),transparent_34%)]" />

      <div className="relative z-10 border-b border-white/8 bg-black/25 backdrop-blur-xl">
        <div
          className={`mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:px-6 lg:px-8 ${
            isOverview ? "py-4" : "py-3"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            {isOverview ? (
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">
                  Private
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                  Music Manager
                </h1>
                <p className="mt-1 text-sm text-white/50">
                  Review songs, manage buckets, and shape playlist flow.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">
                  Private
                </p>
                <h1 className="mt-1 text-lg font-semibold text-white">
                  Music Manager
                </h1>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Link
                href="/music"
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/72 transition hover:bg-white/[0.08]"
              >
                Public music
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/72 transition hover:bg-white/[0.08]"
              >
                Dashboard
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href, item.match);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative overflow-hidden rounded-full border px-4 py-2 text-sm transition ${
                    active
                      ? "border-white/16 bg-white/[0.1] text-white"
                      : "border-white/8 bg-white/[0.03] text-white/58 hover:border-white/14 hover:text-white"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="music-manage-nav"
                      className="absolute inset-0 bg-white/[0.08]"
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}

            {pathname.includes("/music/manage/sequencer/") && (
              <span className="rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-sm text-white">
                Sequencer
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
