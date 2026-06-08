"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Doodle } from "./sketchbook";
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
  size = "base",
}: {
  href: string;
  label: string;
  tone: Tone;
  active: boolean;
  size?: "base" | "sm";
}) {
  const c = `rgb(var(${toneVar[tone]}))`;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative inline-flex flex-col items-center font-hand leading-none transition-colors ${
        size === "sm" ? "text-lg" : "text-2xl"
      } ${active ? "" : "text-ink-soft hover:text-ink"}`}
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

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* main row */}
        <div className="flex h-14 items-center justify-between gap-4">
          <Link href="/" className="group flex items-baseline gap-1 font-serif text-lg font-medium tracking-tight text-ink">
            pramit mazumder<span className="text-accent-rust">.</span>
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
