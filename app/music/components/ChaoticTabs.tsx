"use client";

import { motion } from "motion/react";
import { generateChaoticStyle, hexToRgb } from "../lib/chaotic-styles";

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
      {tabs.map((tab, index) => {
        const isSelected = selectedTab === tab.id;
        const style = generateChaoticStyle(index + 100);

        return (
          <motion.button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`
              relative px-4 md:px-6 py-2.5 md:py-3 rounded-full transition-all duration-300 overflow-hidden
              ${
                isSelected
                  ? "bg-white/15 text-white"
                  : "bg-white/[0.06] text-gray-400 hover:bg-white/10 hover:text-white"
              }
            `}
            style={{
              rotate: isSelected ? 0 : style.rotation * 0.3,
              boxShadow: isSelected
                ? `0 10px 40px -10px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`
                : undefined,
            }}
            whileHover={{
              scale: 1.05,
              rotate: 0,
            }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Glow effect */}
            {isSelected && (
              <motion.div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(90deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2), transparent, rgba(124, 119, 198, 0.2))`,
                }}
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}

            <span className="relative z-10 font-light text-sm md:text-base">
              {tab.label}
            </span>

            {tab.count > 0 && (
              <motion.span
                className="relative z-10 ml-2 text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: isSelected
                    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`
                    : "rgba(255, 255, 255, 0.1)",
                  color: isSelected ? accentColor : "rgb(107, 114, 128)",
                }}
                animate={isSelected ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {tab.count}
              </motion.span>
            )}

            {/* Bottom accent line */}
            <motion.div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5"
              style={{
                background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
              }}
              initial={{ width: 0, opacity: 0 }}
              animate={{
                width: isSelected ? "80%" : "0%",
                opacity: isSelected ? 1 : 0,
              }}
              transition={{ duration: 0.3 }}
            />
          </motion.button>
        );
      })}
    </motion.div>
  );
}
