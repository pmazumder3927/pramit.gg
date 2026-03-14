"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

const NAV_ITEMS = [
  { href: "/music/manage", label: "Overview", match: "/music/manage" },
  { href: "/music/manage/review", label: "Review", match: "/music/manage/review" },
  { href: "/music/manage/status", label: "Status", match: "/music/manage/status" },
  { href: "/music/manage/graveyard", label: "Graveyard", match: "/music/manage/graveyard" },
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

      <div className="relative z-10 border-b border-white/[0.06] bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-5">
            <Link
              href="/music/manage"
              className="group flex items-baseline gap-px transition"
            >
              <span className="text-sm font-light text-white/40 transition-colors group-hover:text-white/65">
                its 3 am
              </span>
            </Link>

            <div className="h-4 w-px bg-white/[0.08]" />

            <nav className="flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href, item.match);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative rounded-full px-3.5 py-1.5 text-[11px] tracking-wide transition ${
                      active
                        ? "text-white"
                        : "text-white/30 hover:text-white/55"
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="3am-nav"
                        className="absolute inset-0 rounded-full bg-white/[0.08] ring-1 ring-white/[0.06]"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}

              {isSequencer && (
                <>
                  <span className="mx-1.5 text-white/15">/</span>
                  <span className="rounded-full bg-accent-orange/10 px-3 py-1.5 text-[11px] tracking-wide text-accent-orange/80">
                    Sequencer
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href="/music"
              className="rounded-full px-3 py-1.5 text-[11px] text-white/25 transition hover:bg-white/[0.04] hover:text-white/50"
            >
              Public
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full px-3 py-1.5 text-[11px] text-white/25 transition hover:bg-white/[0.04] hover:text-white/50"
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
