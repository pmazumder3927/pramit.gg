'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function useNavigationLoading() {
  const [isNavigationLoading, setIsNavigationLoading] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const startNavigationLoading = useCallback((url: string) => {
    if (url === pathname) return; // Don't load if already on the page
    
    setTargetUrl(url);
    setIsNavigationLoading(true);
    
    // Start navigation
    router.push(url);
  }, [pathname, router]);

  const stopNavigationLoading = useCallback(() => {
    setIsNavigationLoading(false);
    setTargetUrl(null);
  }, []);

  // Stop loading when pathname changes (navigation completed)
  useEffect(() => {
    if (targetUrl && pathname === targetUrl) {
      const timer = setTimeout(() => {
        stopNavigationLoading();
      }, 300); // Small delay to show completion
      
      return () => clearTimeout(timer);
    }
  }, [pathname, targetUrl, stopNavigationLoading]);

  return {
    isNavigationLoading,
    targetUrl,
    startNavigationLoading,
    stopNavigationLoading
  };
}