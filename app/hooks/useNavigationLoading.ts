'use client';

import { useState, useCallback } from 'react';

export function useNavigationLoading() {
  const [isNavigationLoading, setIsNavigationLoading] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);

  const startNavigationLoading = useCallback((url: string) => {
    setTargetUrl(url);
    setIsNavigationLoading(true);
    
    // Start navigation immediately
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  }, []);

  const stopNavigationLoading = useCallback(() => {
    setIsNavigationLoading(false);
    setTargetUrl(null);
  }, []);

  return {
    isNavigationLoading,
    targetUrl,
    startNavigationLoading,
    stopNavigationLoading
  };
}