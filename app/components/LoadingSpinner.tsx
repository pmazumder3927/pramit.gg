"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface LoadingSpinnerProps {
  isLoading?: boolean;
  fullscreen?: boolean;
  className?: string;
}

export default function LoadingSpinner({
  isLoading = true,
  fullscreen = false,
  className = "",
}: LoadingSpinnerProps) {
  const [shouldShow, setShouldShow] = useState(isLoading);

  useEffect(() => {
    setShouldShow(isLoading);
  }, [isLoading]);

  if (!shouldShow) return null;

  const containerClass = fullscreen
    ? "fixed inset-0 bg-gradient-to-br from-void-black via-charcoal-black to-void-black flex items-center justify-center z-50"
    : "flex items-center justify-center relative";

  return (
    <>
      {/* Loading animation container */}
      <div className={`${containerClass} ${className}`}>
        <div className="relative">
          {/* Bold outer rotating ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            }}
            className="w-32 h-32 border-2 border-accent-orange/30 rounded-full"
          />

          {/* Dramatic pulsing core */}
          <motion.div
            animate={{
              scale: [1, 1.8, 1],
              opacity: [0.9, 0.3, 0.9],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            className="absolute inset-0 m-auto w-12 h-12 bg-gradient-to-r from-accent-orange to-accent-purple rounded-full"
          />

          {/* Explosive particle burst */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                x: [0, Math.cos((i * 30 * Math.PI) / 180) * 50, 0],
                y: [0, Math.sin((i * 30 * Math.PI) / 180) * 50, 0],
                scale: [0, 1.5, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.1,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="absolute top-1/2 left-1/2 w-3 h-3 bg-gradient-to-r from-accent-orange to-accent-purple rounded-full transform -translate-x-1/2 -translate-y-1/2"
            />
          ))}

          {/* Fast counter-rotating inner ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute inset-0 m-auto w-20 h-20 border-2 border-accent-purple/40 rounded-full border-dashed"
          />

          {/* Intense glowing backdrop */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            className="absolute inset-0 m-auto w-40 h-40 bg-gradient-to-r from-accent-orange/10 to-accent-purple/10 rounded-full blur-2xl -z-10"
          />

          {/* Sharp rotating diamond */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute inset-0 m-auto w-6 h-6 bg-white/20 rounded-sm transform rotate-45"
          />
        </div>
      </div>
    </>
  );
}
