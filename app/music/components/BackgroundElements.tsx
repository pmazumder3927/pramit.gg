"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { seededRandom } from "../lib/chaotic-styles";

interface BackgroundElementsProps {
  primaryColor?: string;
  secondaryColor?: string;
}

export function FloatingShapes({
  primaryColor = "#ff6b3d",
  secondaryColor = "#7c77c6",
}: BackgroundElementsProps) {
  const shapes = useMemo(() => {
    return [...Array(6)].map((_, i) => ({
      x: 10 + seededRandom(i * 1100) * 80,
      y: 10 + seededRandom(i * 1200) * 80,
      size: 60 + seededRandom(i * 1300) * 120,
      rotation: seededRandom(i * 1400) * 45,
      type: seededRandom(i * 1500) > 0.5 ? "ring" : "square",
      usePrimary: seededRandom(i * 1600) > 0.5,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {shapes.map((shape, i) => (
        <motion.div
          key={`shape-${i}`}
          className="absolute opacity-[0.04]"
          style={{
            left: `${shape.x}%`,
            top: `${shape.y}%`,
          }}
          animate={{
            y: [0, -10, 0],
            rotate: [shape.rotation, shape.rotation + 5, shape.rotation],
          }}
          transition={{
            duration: 8 + i * 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {shape.type === "ring" ? (
            <motion.div
              className="rounded-full border-2"
              style={{
                width: shape.size,
                height: shape.size,
                borderColor: shape.usePrimary ? primaryColor : secondaryColor,
              }}
              animate={{
                borderColor: shape.usePrimary ? primaryColor : secondaryColor,
              }}
              transition={{ duration: 1 }}
            />
          ) : (
            <motion.div
              className="border-2"
              style={{
                width: shape.size,
                height: shape.size,
                borderColor: shape.usePrimary ? primaryColor : secondaryColor,
                transform: `rotate(${shape.rotation}deg)`,
              }}
              animate={{
                borderColor: shape.usePrimary ? primaryColor : secondaryColor,
              }}
              transition={{ duration: 1 }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}

export function ScatteredElements({
  primaryColor = "#ff6b3d",
  secondaryColor = "#7c77c6",
}: BackgroundElementsProps) {
  const elements = useMemo(() => {
    return [...Array(8)].map((_, i) => ({
      type: seededRandom(i * 100) > 0.6 ? "note" : "line",
      x: seededRandom(i * 300) * 100,
      y: seededRandom(i * 400) * 100,
      rotation: seededRandom(i * 500) * 360,
      size: 20 + seededRandom(i * 600) * 40,
      usePrimary: seededRandom(i * 800) > 0.5,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {elements.map((el, i) => {
        const color = el.usePrimary ? primaryColor : secondaryColor;
        return (
          <motion.div
            key={i}
            className="absolute opacity-[0.08]"
            style={{
              left: `${el.x}%`,
              top: `${el.y}%`,
            }}
            animate={{
              opacity: [0.08, 0.15, 0.08],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {el.type === "note" ? (
              <motion.svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                style={{ transform: `rotate(${el.rotation}deg)` }}
                animate={{ fill: color }}
                transition={{ duration: 1 }}
              >
                <path
                  fill={color}
                  d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                />
              </motion.svg>
            ) : (
              <motion.div
                className="h-px origin-center"
                style={{
                  width: el.size,
                  backgroundColor: color,
                  transform: `rotate(${el.rotation}deg)`,
                }}
                animate={{ backgroundColor: color }}
                transition={{ duration: 1 }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

export function GradientOrbs({
  primaryColor = "#ff6b3d",
}: {
  primaryColor?: string;
}) {
  return (
    <>
      <motion.div
        className="fixed top-20 left-0 w-64 md:w-96 h-64 md:h-96 rounded-full blur-3xl pointer-events-none opacity-[0.05]"
        animate={{ backgroundColor: primaryColor }}
        transition={{ duration: 2 }}
      />
      <div className="fixed bottom-20 right-0 w-64 md:w-96 h-64 md:h-96 bg-accent-purple/5 rounded-full blur-3xl pointer-events-none" />
      <motion.div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-[0.03]"
        animate={{ backgroundColor: primaryColor }}
        transition={{ duration: 2 }}
      />
    </>
  );
}
