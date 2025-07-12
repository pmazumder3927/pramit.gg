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

// Particle configuration for swirling effect - generated on client side
function generateParticles() {
  if (typeof window === 'undefined') return [];
  
  return Array.from({ length: 20 }, (_, i) => ({
    id: i,
    size: Math.random() * 8 + 4,
    color: ['#ff6b3d', '#7c77c6', '#4a9eff', '#30d158', '#ff375f', '#ffd60a'][Math.floor(Math.random() * 6)],
    initialX: Math.random() * window.innerWidth,
    initialY: Math.random() * window.innerHeight,
    duration: Math.random() * 3 + 2,
  }));
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
    }, 800);
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
  const [showExit, setShowExit] = useState(false);
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    // Generate particles on client side
    setParticles(generateParticles());
    
    const timer = setTimeout(() => setShowExit(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100]"
      style={{ pointerEvents: 'none' }}
    >
      {/* Dark overlay background */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.8 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gradient-to-br from-void-black/95 via-charcoal-black/95 to-void-black/95 backdrop-blur-sm"
        style={{ pointerEvents: 'auto' }}
      />

      {/* Swirling particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            left: particle.initialX,
            top: particle.initialY,
            boxShadow: `0 0 ${particle.size * 2}px ${particle.color}50`,
          }}
          initial={{ 
            scale: 0,
            x: 0,
            y: 0,
          }}
          animate={showExit ? {
            scale: [1, 0],
            x: [
              0,
              Math.sin(particle.id) * 200,
              Math.sin(particle.id * 2) * 400,
              (Math.random() - 0.5) * (typeof window !== 'undefined' ? window.innerWidth : 1000) * 2,
            ],
            y: [
              0,
              Math.cos(particle.id) * 200,
              Math.cos(particle.id * 2) * 400,
              (Math.random() - 0.5) * (typeof window !== 'undefined' ? window.innerHeight : 800) * 2,
            ],
            opacity: [1, 1, 0.5, 0],
          } : {
            scale: [0, 1, 1],
            x: [
              0,
              Math.sin(particle.id) * 100,
              Math.sin(particle.id * 2) * 150,
            ],
            y: [
              0,
              Math.cos(particle.id) * 100,
              Math.cos(particle.id * 2) * 150,
            ],
            opacity: [0, 1, 1],
          }}
          transition={{
            duration: showExit ? 1.5 : particle.duration,
            repeat: showExit ? 0 : Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Central vortex */}
      <motion.div
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0, rotate: 0 }}
        animate={showExit ? {
          scale: [1, 2, 0],
          rotate: [0, 180, 360],
          opacity: [1, 0.5, 0],
        } : {
          scale: [0, 1, 1],
          rotate: [0, 360],
          opacity: [0, 1, 1],
        }}
        transition={{
          duration: showExit ? 0.8 : 2,
          rotate: { 
            duration: showExit ? 0.8 : 4, 
            repeat: showExit ? 0 : Infinity, 
            ease: "linear" 
          },
        }}
      >
        {/* Inner ring */}
        <div className="w-32 h-32 border-2 border-accent-orange/40 rounded-full" />
        
        {/* Middle ring */}
        <motion.div
          className="absolute inset-0 w-32 h-32 border-2 border-accent-purple/40 rounded-full"
          animate={{ rotate: -360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 -m-8 w-48 h-48 border border-accent-blue/30 rounded-full"
          animate={{ rotate: 180 }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />

        {/* Center glow */}
        <div className="absolute inset-0 m-auto w-8 h-8 bg-gradient-to-r from-accent-orange to-accent-purple rounded-full blur-md" />
      </motion.div>

      {/* Flowing lines */}
      <svg className="absolute inset-0 w-full h-full">
        {[...Array(6)].map((_, i) => {
          const startAngle = (i * 60) * Math.PI / 180;
          const endAngle = ((i * 60) + 120) * Math.PI / 180;
          const radius = 200;
          const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
          const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 400;
          
          return (
            <motion.path
              key={i}
              d={`M ${centerX + Math.cos(startAngle) * 50} ${centerY + Math.sin(startAngle) * 50} 
                  Q ${centerX + Math.cos((startAngle + endAngle) / 2) * radius} ${centerY + Math.sin((startAngle + endAngle) / 2) * radius} 
                  ${centerX + Math.cos(endAngle) * 50} ${centerY + Math.sin(endAngle) * 50}`}
              stroke={['#ff6b3d', '#7c77c6', '#4a9eff'][i % 3]}
              strokeWidth="1"
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={showExit ? {
                pathLength: [1, 0],
                opacity: [0.3, 0],
              } : {
                pathLength: [0, 1, 1],
                opacity: [0, 0.3, 0.3],
              }}
              transition={{
                duration: showExit ? 0.8 : 2,
                repeat: showExit ? 0 : Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
                delay: i * 0.2,
              }}
            />
          );
        })}
      </svg>
    </motion.div>
  );
}