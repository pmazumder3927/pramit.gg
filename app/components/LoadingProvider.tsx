'use client';

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import BlobLoader from './BlobLoader';

interface LoadingContextValue {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextValue | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const firstLoadSkipped = useRef(false);

  /**
   * Expose imperative controls so individual pages can manually trigger the
   * loader when fetching data client-side (e.g. click → fetch → navigate).
   */
  const startLoading = useCallback(() => setIsLoading(true), []);
  const stopLoading = useCallback(() => setIsLoading(false), []);

  // Automatic navigation detection – fire loader whenever the route changes
  useEffect(() => {
    // Skip loader on first render to avoid flashing while SSR content paints
    if (!firstLoadSkipped.current) {
      firstLoadSkipped.current = true;
      return;
    }
    startLoading();
    // Heuristic – Stop after 800 ms in case consuming page doesn’t stop it
    // earlier. Pages can call stopLoading as soon as their data is ready to
    // get a snappier exit.
    const timer = setTimeout(() => stopLoading(), 800);
    return () => clearTimeout(timer);
  }, [pathname, startLoading, stopLoading]);

  return (
    <LoadingContext.Provider value={{ isLoading, startLoading, stopLoading }}>
      {/* Children go underneath so loader overlays them visually */}
      {children}
      <BlobLoader active={isLoading} />
    </LoadingContext.Provider>
  );
}

export const useGlobalLoading = () => {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error('useGlobalLoading must be used within LoadingProvider');
  }
  return ctx;
};