"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Doodle } from "./sketchbook";
import SiteMark from "./SiteMark";
import ThemeToggle from "./ThemeToggle";

type Tone = "rust" | "purple" | "orange";

const LINKS: { href: string; label: string; tone: Tone }[] = [
  { href: "/", label: "writing", tone: "rust" },
  { href: "/music", label: "sound", tone: "purple" },
  { href: "/collage", label: "collage", tone: "orange" },
  { href: "/connect", label: "connect", tone: "rust" },
];

const toneVar: Record<Tone, string> = {
  rust: "--accent-rust",
  purple: "--accent-purple",
  orange: "--accent-orange",
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLink({
  href,
  label,
  tone,
  active,
}: {
  href: string;
  label: string;
  tone: Tone;
  active: boolean;
}) {
  const c = `rgb(var(${toneVar[tone]}))`;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative inline-flex flex-col items-center font-hand text-2xl leading-none transition-colors ${
        active ? "" : "text-ink-soft hover:text-ink"
      }`}
      style={active ? { color: c } : undefined}
    >
      {label}
      {/* hand-drawn underline marks the current page; a faint one fades in on hover */}
      <Doodle
        name="underline"
        tone={tone}
        className={`mt-0.5 h-2 w-full transition-opacity duration-200 ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-50"
        }`}
        strokeWidth={3}
      />
    </Link>
  );
}

export default function SketchbookNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  // On the homepage the giant hero headline IS the name — so the nav wordmark
  // stays hidden until you scroll past the hero, then it slides in. Everywhere
  // else there's no hero name, so the wordmark is always present.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const showWordmark = !isHome || scrolled;

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* identity: the favicon mark, always; the wordmark reveals on scroll */}
          <Link
            href="/"
            aria-label="pramit mazumder — home"
            className="group flex items-center gap-2"
          >
            <SiteMark
              size={26}
              className="-rotate-3 transition-transform duration-500 group-hover:rotate-3"
            />
            <span
              className="overflow-hidden whitespace-nowrap font-serif text-lg font-medium tracking-tight text-ink transition-all duration-500 ease-out"
              style={{
                maxWidth: showWordmark ? "16rem" : 0,
                opacity: showWordmark ? 1 : 0,
                transform: showWordmark ? "none" : "translateX(-8px)",
              }}
            >
              pramit mazumder<span className="text-accent-rust">.</span>
            </span>
          </Link>

          {/* desktop links */}
          <nav className="hidden items-center gap-8 md:flex">
            {LINKS.map((l) => (
              <NavLink key={l.href} {...l} active={isActive(pathname, l.href)} />
            ))}
          </nav>

          <ThemeToggle />
        </div>
        {/* mobile navigation lives in the bottom tab bar (SketchbookTabBar) */}
      </div>
    </header>
  );
}
