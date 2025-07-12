"use client";

import { LoadingProvider } from '../lib/loadingContext';
import BlobLoader from './BlobLoader';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <LoadingProvider>
      <BlobLoader />
      <NavigationInterceptor />
      {children}
    </LoadingProvider>
  );
}

// Component to intercept navigation events
function NavigationInterceptor() {
  const pathname = usePathname();
  
  useEffect(() => {
    // Listen for navigation events
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      
      if (link && link.href && link.href.startsWith(window.location.origin)) {
        // Internal navigation detected
        // The LoadingProvider will handle this via pathname changes
      }
    };

    document.addEventListener('click', handleClick, true);
    
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

  return null;
}