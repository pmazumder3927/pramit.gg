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
  if (href === "/music/manage") return pathname === href;
  return pathname === href || pathname.startsWith(`${match}/`);
}

export function MusicManagerShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSequencer = pathname.includes("/music/manage/sequencer/");

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black page-reveal">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(255,107,61,0.06),transparent_30%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_88%_14%,rgba(124,119,198,0.06),transparent_34%)]" />

      <div className="relative z-10 border-b border-white/[0.06] bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/music/manage"
              className="text-sm font-medium text-white/70 transition hover:text-white"
            >
              Music Manager
            </Link>

            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href, item.match);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative rounded-lg px-3 py-1.5 text-xs transition ${
                      active
                        ? "text-white"
                        : "text-white/35 hover:text-white/60"
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="music-manage-nav"
                        className="absolute inset-0 rounded-lg bg-white/[0.08]"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}

              {isSequencer && (
                <span className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs text-white">
                  Sequencer
                </span>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/music"
              className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-white/40 transition hover:text-white/60"
            >
              Public
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-white/40 transition hover:text-white/60"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
