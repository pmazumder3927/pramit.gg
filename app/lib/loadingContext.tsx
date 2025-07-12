"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface LoadingContextType {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  direction: 'left' | 'right';
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const loadingTimer = useRef<NodeJS.Timeout>();

  // Track navigation
  useEffect(() => {
    // Skip initial mount
    if (previousPathname.current === pathname) return;
    
    // Clear any existing timer
    if (loadingTimer.current) {
      clearTimeout(loadingTimer.current);
    }
    
    // Start loading immediately on route change
    setIsLoading(true);
    
    // Determine direction based on route hierarchy or default to right
    const prevSegments = previousPathname.current.split('/').filter(Boolean);
    const currSegments = pathname.split('/').filter(Boolean);
    
    if (prevSegments.length > currSegments.length) {
      setDirection('left');
    } else {
      setDirection('right');
    }
    
    previousPathname.current = pathname;
    
    // Minimum loading time for smooth animation
    loadingTimer.current = setTimeout(() => {
      setIsLoading(false);
    }, 1800);

    return () => {
      if (loadingTimer.current) {
        clearTimeout(loadingTimer.current);
      }
    };
  }, [pathname]);

  const startLoading = useCallback(() => {
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    // Add slight delay to ensure smooth exit animation
    setTimeout(() => {
      setIsLoading(false);
    }, 300);
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, startLoading, stopLoading, direction }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}