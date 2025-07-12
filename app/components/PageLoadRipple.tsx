"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PageLoadRippleProps {
  onComplete?: () => void;
}

export default function PageLoadRipple({ onComplete }: PageLoadRippleProps) {
  const [showRipple, setShowRipple] = useState(false);

  useEffect(() => {
    // Trigger ripple effect when component mounts (page loads)
    const timer = setTimeout(() => {
      setShowRipple(true);
      
      // Complete the ripple effect
      setTimeout(() => {
        setShowRipple(false);
        onComplete?.();
      }, 1200);
    }, 100);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {showRipple && (
        <motion.div
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 25, opacity: 0 }}
          exit={{ scale: 30, opacity: 0 }}
          transition={{ 
            duration: 1.2, 
            ease: [0.25, 0.1, 0.25, 1] 
          }}
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
        >
          <div className="w-16 h-16 bg-gradient-to-r from-accent-orange/25 to-accent-purple/25 rounded-full blur-sm" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}