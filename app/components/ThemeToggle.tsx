"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // React 19 hydration reconciles <html>'s className, stripping the class the
    // pre-paint script in layout.tsx added — re-derive and re-apply it here.
    let next: Theme = "light";
    try {
      const stored = localStorage.getItem("theme");
      if (
        stored === "dark" ||
        (!stored && matchMedia("(prefers-color-scheme: dark)").matches)
      ) {
        next = "dark";
      }
    } catch {}
    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={theme === "dark" ? "lights on" : "lights off"}
      className="group flex h-11 w-11 items-center justify-center rounded-full border border-line/80 bg-card/70 text-ink-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-orange/60 hover:text-accent-orange"
    >
      {/* keep markup stable before mount to avoid hydration flash */}
      <span className="sr-only">toggle theme</span>
      {mounted && theme === "dark" ? (
        // sun
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // moon
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
