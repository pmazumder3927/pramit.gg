"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface LoadingSpinnerProps {
  isLoading: boolean;
  fullscreen?: boolean;
  className?: string;
  type?: 'navigation' | 'content';
}

export default function LoadingSpinner({ 
  isLoading, 
  fullscreen = false, 
  className = "",
  type = 'content'
}: LoadingSpinnerProps) {
  const [isFinishing, setIsFinishing] = useState(false);
  const [shouldShow, setShouldShow] = useState(isLoading);
  const [showRipple, setShowRipple] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setShouldShow(true);
      setIsFinishing(false);
    } else {
      // Start finishing sequence
      setIsFinishing(true);
      setShowRipple(true);
      
      // Keep showing until animation completes
      const timer = setTimeout(() => {
        setShouldShow(false);
        setIsFinishing(false);
        setShowRipple(false);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
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
          {/* Main rotating ring with gradient */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ 
              duration: 3, 
              repeat: isFinishing ? 0 : Infinity, 
              ease: 'linear' 
            }}
            className="w-24 h-24 border-2 border-accent-orange/60 rounded-full"
          />
          
          {/* Pulsing core */}
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.8, 0.4, 0.8]
            }}
            transition={{ 
              duration: 2, 
              repeat: isFinishing ? 0 : Infinity, 
              ease: [0.4, 0, 0.6, 1]
            }}
            className="absolute inset-0 m-auto w-8 h-8 bg-gradient-to-r from-accent-orange to-accent-purple rounded-full"
          />
          
          {/* Enhanced particle system */}
          {[...Array(16)].map((_, i) => {
            const angle = (i * 22.5) * Math.PI / 180;
            const radius = 40;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            return (
              <motion.div
                key={i}
                animate={{
                  x: [0, x, 0],
                  y: [0, y, 0],
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0]
                }}
                transition={{
                  duration: 2.5,
                  repeat: isFinishing ? 0 : Infinity,
                  delay: i * 0.08,
                  ease: [0.25, 0.1, 0.25, 1]
                }}
                className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  background: i % 4 === 0 ? '#ff6b3d' : 
                             i % 4 === 1 ? '#7c77c6' : 
                             i % 4 === 2 ? '#4a9eff' : '#ff375f'
                }}
              />
            );
          })}
          
          {/* Counter-rotating inner ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ 
              duration: 2, 
              repeat: isFinishing ? 0 : Infinity, 
              ease: 'linear' 
            }}
            className="absolute inset-0 m-auto w-16 h-16 border border-white/20 rounded-full"
          />
          
          {/* Subtle glow */}
          <motion.div 
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ 
              duration: 3, 
              repeat: isFinishing ? 0 : Infinity, 
              ease: [0.4, 0, 0.6, 1]
            }}
            className="absolute inset-0 m-auto w-32 h-32 bg-gradient-to-r from-accent-orange/10 to-accent-purple/10 rounded-full blur-xl -z-10"
          />
        </div>
      </div>

      {/* Ripple effect overlay */}
      {showRipple && (
        <motion.div
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 20, opacity: 0 }}
          transition={{ 
            duration: 1, 
            ease: [0.25, 0.1, 0.25, 1] 
          }}
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
        >
          <div className="w-16 h-16 bg-gradient-to-r from-accent-orange/20 to-accent-purple/20 rounded-full" />
        </motion.div>
      )}
    </>
  );
}