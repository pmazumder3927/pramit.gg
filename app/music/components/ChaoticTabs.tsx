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

export function ChaoticTabs({
  tabs,
  selectedTab,
  onSelect,
  accentColor = "#ff6b3d",
}: ChaoticTabsProps) {
  const rgb = hexToRgb(accentColor);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="flex flex-wrap gap-3 justify-center mb-8 md:mb-12"
    >
      {tabs.map((tab) => {
        const isSelected = selectedTab === tab.id;

        return (
          <motion.button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`
              group relative px-5 md:px-7 py-3 md:py-4 rounded-xl transition-all duration-300
              ${
                isSelected
                  ? "bg-white/[0.04] border border-white/10"
                  : "bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10"
              }
            `}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Corner accents on selected */}
            {isSelected && (
              <>
                <div className="absolute top-0 left-0 w-5 h-px" style={{ backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)` }} />
                <div className="absolute top-0 left-0 w-px h-5" style={{ backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)` }} />
                <div className="absolute bottom-0 right-0 w-5 h-px" style={{ backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)` }} />
                <div className="absolute bottom-0 right-0 w-px h-5" style={{ backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)` }} />
              </>
            )}

            <div className="flex flex-col items-center gap-1">
              <span className={`font-light text-sm md:text-base transition-colors duration-300 ${
                isSelected ? "text-white/90" : "text-white/40 group-hover:text-white/70"
              }`}>
                {tab.label}
              </span>

              {tab.count > 0 && (
                <span
                  className="text-[10px] md:text-xs tabular-nums transition-colors duration-300"
                  style={{
                    color: isSelected
                      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`
                      : "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  {tab.count} {tab.id === "playlists" ? "playlists" : "songs"}
                </span>
              )}
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
