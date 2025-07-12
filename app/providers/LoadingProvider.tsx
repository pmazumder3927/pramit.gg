'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingContextType {
  isLoading: boolean;
  startLoading: (targetUrl?: string) => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
}

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const pathname = usePathname();

  const startLoading = useCallback((url?: string) => {
    if (url) setTargetUrl(url);
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    // Delay to show exit animation
    setTimeout(() => {
      setIsLoading(false);
      setTargetUrl(null);
    }, 1000);
  }, []);

  // Monitor pathname changes
  useEffect(() => {
    if (targetUrl && pathname === targetUrl) {
      stopLoading();
    }
  }, [pathname, targetUrl, stopLoading]);

  return (
    <LoadingContext.Provider value={{ isLoading, startLoading, stopLoading }}>
      {children}
      <AnimatePresence>
        {isLoading && <LoadingOverlay />}
      </AnimatePresence>
    </LoadingContext.Provider>
  );
}

function LoadingOverlay() {
  const [isExiting, setIsExiting] = useState(false);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const exitTimer = setTimeout(() => setIsExiting(true), 600);
    
    // Animation loop for smooth motion
    let animationId: number;
    const animate = () => {
      setTime(Date.now() / 1000);
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    
    return () => {
      clearTimeout(exitTimer);
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Create a cohesive blob of particles
  const particleCount = 40;
  const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
  const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 400;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-[100]"
      style={{ pointerEvents: 'none' }}
    >
      {/* Subtle dark overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gradient-to-br from-void-black/50 via-transparent to-void-black/50"
        style={{ pointerEvents: 'auto' }}
      />

      {/* Traveling blob container */}
      <motion.div
        className="absolute inset-0"
        initial={{ x: -200, opacity: 0 }}
        animate={isExiting ? {
          x: typeof window !== 'undefined' ? window.innerWidth + 200 : 1200,
          opacity: [1, 1, 0],
        } : {
          x: centerX - 150,
          opacity: 1,
        }}
        transition={{
          x: { 
            duration: isExiting ? 0.8 : 0.6, 
            ease: isExiting ? [0.4, 0, 1, 1] : [0, 0, 0.2, 1] 
          },
          opacity: { duration: 0.4 }
        }}
      >
        {/* Globular particle system */}
        {Array.from({ length: particleCount }, (_, i) => {
          // Create particles in a blob formation using gaussian distribution
          const angle = (i / particleCount) * Math.PI * 2;
          const layer = Math.floor(i / 8); // Create concentric layers
          const layerRadius = 30 + layer * 20;
          const radiusVariation = (Math.random() - 0.5) * 20;
          const particleX = Math.cos(angle) * (layerRadius + radiusVariation);
          const particleY = Math.sin(angle) * (layerRadius + radiusVariation) * 0.6; // Flatten vertically for more blob-like shape
          
          // Size based on layer (larger in middle)
          const size = Math.max(3, 12 - layer * 2);
          
          // Gradient from center to edges
          const distanceRatio = layer / 3;
          const brightness = 1 - distanceRatio * 0.3;
          const color = `hsl(20, ${90 - distanceRatio * 20}%, ${50 + brightness * 20}%)`;
          
          // Shared motion for cohesion
          const sharedOffsetX = Math.sin(time * 0.5) * 15;
          const sharedOffsetY = Math.cos(time * 0.5) * 10;
          
          return (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: size,
                height: size,
                backgroundColor: color,
                left: centerY,
                top: centerY,
                boxShadow: `0 0 ${size * 3}px ${color}60`,
                filter: `blur(${0.3 + layer * 0.1}px)`,
              }}
              initial={{ 
                x: particleX,
                y: particleY,
                scale: 0,
              }}
              animate={{
                x: particleX + sharedOffsetX + Math.sin(i * 0.5) * 5,
                y: particleY + sharedOffsetY + Math.cos(i * 0.5) * 5,
                scale: isExiting ? [1, 0.8, 0] : [0, 1, 1],
                opacity: isExiting ? [brightness, brightness * 0.5, 0] : [0, brightness, brightness],
              }}
              transition={{
                x: { 
                  duration: 0.1,
                  ease: "linear",
                },
                y: { 
                  duration: 0.1,
                  ease: "linear",
                },
                scale: { duration: isExiting ? 0.6 : 0.4, ease: "easeOut" },
                opacity: { duration: 0.4 },
              }}
            />
          );
        })}

        {/* Core glow effect */}
        <motion.div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 200,
            height: 200,
            background: 'radial-gradient(circle, rgba(255,107,61,0.3) 0%, rgba(255,107,61,0.1) 40%, transparent 70%)',
            left: centerY - 100,
            top: centerY - 100,
          }}
          animate={{
            scale: isExiting ? [1, 1.5, 0] : [0.8, 1.2, 0.8],
            opacity: isExiting ? [0.6, 0.3, 0] : [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: isExiting ? 0.6 : 2,
            repeat: isExiting ? 0 : Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Leading edge particles - smaller, faster */}
        {Array.from({ length: 10 }, (_, i) => {
          const angle = (i / 10) * Math.PI * 2;
          const x = Math.cos(angle) * 120 + 80; // Leading edge
          const y = Math.sin(angle) * 60;
          
          return (
            <motion.div
              key={`lead-${i}`}
              className="absolute rounded-full"
              style={{
                width: 4,
                height: 4,
                backgroundColor: '#ffd60a',
                left: centerY,
                top: centerY,
                boxShadow: '0 0 8px #ffd60a60',
              }}
              animate={{
                x: [x, x + 20, x],
                y: [y, y + Math.sin(i) * 10, y],
                opacity: [0.6, 1, 0.6],
              }}
              transition={{
                duration: 1 + Math.random() * 0.5,
                repeat: isExiting ? 0 : Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}

        {/* Trailing particles */}
        {Array.from({ length: 15 }, (_, i) => {
          const angle = (i / 15) * Math.PI * 2;
          const x = Math.cos(angle) * 80 - 60; // Trailing edge
          const y = Math.sin(angle) * 40;
          
          return (
            <motion.div
              key={`trail-${i}`}
              className="absolute rounded-full"
              style={{
                width: 3,
                height: 3,
                backgroundColor: '#7c77c6',
                left: centerY,
                top: centerY,
                opacity: 0.4,
              }}
              animate={{
                x: [x, x - 30, x - 60, x - 30, x],
                y: [y, y + Math.sin(i) * 15, y],
                opacity: isExiting ? [0.4, 0.2, 0] : [0.2, 0.4, 0.2],
                scale: isExiting ? [1, 0.5, 0] : [1, 0.8, 1],
              }}
              transition={{
                duration: 2 + Math.random(),
                repeat: isExiting ? 0 : Infinity,
                ease: "easeOut",
                delay: i * 0.05,
              }}
            />
          );
        })}
      </motion.div>

      {/* Motion blur lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {Array.from({ length: 5 }, (_, i) => {
          const y = centerY + (i - 2) * 30;
          
          return (
            <motion.line
              key={`blur-${i}`}
              x1={0}
              y1={y}
              x2={typeof window !== 'undefined' ? window.innerWidth : 1000}
              y2={y}
              stroke="rgba(255,107,61,0.1)"
              strokeWidth="2"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={isExiting ? {
                pathLength: [0, 1],
                opacity: [0, 0.3, 0],
              } : {
                pathLength: 0,
                opacity: 0,
              }}
              transition={{
                duration: 0.8,
                ease: "easeOut",
              }}
            />
          );
        })}
      </svg>
    </motion.div>
  );
}