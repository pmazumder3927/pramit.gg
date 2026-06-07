"use client";

import { motion } from "motion/react";
import { hexToRgb } from "../lib/chaotic-styles";

interface Tab {
  id: string;
  label: string;
  count: number;
}

interface ChaoticTabsProps {
  tabs: Tab[];
  selectedTab: string;
  onSelect: (id: string) => void;
  accentColor?: string;
}

// each tab is rotated slightly like a stuck-on paper index tab
const TAB_ROT = [-2.4, 1.6, -1.2];

export function ChaoticTabs({
  tabs,
  selectedTab,
  onSelect,
  accentColor = "#ff6b3d",
}: ChaoticTabsProps) {
  const rgb = hexToRgb(accentColor);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="relative mx-auto flex max-w-3xl flex-wrap items-end justify-center gap-x-2 gap-y-3 border-b border-dashed border-line pb-px"
    >
      {tabs.map((tab, i) => {
        const isSelected = selectedTab === tab.id;
        const rot = TAB_ROT[i % TAB_ROT.length];

        return (
          <motion.button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            style={{
              transform: `rotate(${rot}deg)`,
              ...(isSelected
                ? { borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)` }
                : {}),
            }}
            className={`group relative -mb-px rounded-t-[10px] border border-b-0 px-4 py-2.5 transition-all duration-200 md:px-6 md:py-3 ${
              isSelected
                ? "z-10 bg-card shadow-[0_-2px_8px_-4px_rgb(var(--fg)/0.25)]"
                : "translate-y-1 border-line/70 bg-paper-2/60 hover:translate-y-0 hover:bg-card"
            }`}
            whileTap={{ scale: 0.98 }}
          >
            {/* the selected tab gets a colored "tab pull" */}
            {isSelected && (
              <span
                aria-hidden
                className="absolute left-1/2 top-1 h-1 w-8 -translate-x-1/2 rounded-full"
                style={{ backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)` }}
              />
            )}

            <div className="flex flex-col items-center gap-0.5">
              <span
                className={`font-hand text-xl leading-none transition-colors md:text-2xl ${
                  isSelected
                    ? "text-ink"
                    : "text-ink-faint group-hover:text-ink-soft"
                }`}
              >
                {tab.label}
              </span>

              {tab.count > 0 && (
                <span
                  className="font-mono text-[0.62rem] uppercase tracking-[0.14em] tabular-nums transition-colors"
                  style={{
                    color: isSelected
                      ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
                      : "rgb(var(--fg-faint))",
                  }}
                >
                  {tab.count} {tab.id === "playlists" ? "tapes" : "tracks"}
                </span>
              )}
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
