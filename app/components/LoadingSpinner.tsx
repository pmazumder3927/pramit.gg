"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface LoadingSpinnerProps {
  isLoading: boolean;
  fullscreen?: boolean;
  className?: string;
  skeleton?: boolean;
  ripple?: boolean;
}

// Skeleton loading component for progressive enhancement
export function SkeletonLoader({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Featured posts skeleton */}
      <div className="mb-8">
        <div className="h-4 bg-white/5 rounded-lg w-20 mb-4 animate-pulse-subtle" />
        <div className="flex gap-6 overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-80 md:w-96 lg:w-[420px] h-64 bg-white/5 rounded-xl animate-pulse-subtle"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
      
      {/* Main posts grid skeleton */}
      <div className="mb-8">
        <div className="h-4 bg-white/5 rounded-lg w-24 mb-4 animate-pulse-subtle" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-48 bg-white/5 rounded-xl animate-pulse-subtle"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Minimal loading indicator that doesn't block
export function LoadingIndicator({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-6 h-6 border-2 border-accent-orange/30 border-t-accent-orange rounded-full"
      />
    </div>
  );
}

// Ripple effect for satisfying completion
export function RippleEffect({ 
  trigger, 
  onComplete,
  className = "" 
}: { 
  trigger: boolean;
  onComplete?: () => void;
  className?: string;
}) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger) {
      setIsActive(true);
      const timer = setTimeout(() => {
        setIsActive(false);
        onComplete?.();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 20, opacity: 0 }}
          exit={{ scale: 20, opacity: 0 }}
          transition={{ 
            duration: 0.8, 
            ease: [0.25, 0.1, 0.25, 1] 
          }}
          className={`fixed inset-0 flex items-center justify-center pointer-events-none z-50 ${className}`}
        >
          <div className="w-16 h-16 bg-gradient-to-r from-accent-orange/20 to-accent-purple/20 rounded-full" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function LoadingSpinner({ 
  isLoading, 
  fullscreen = false, 
  className = "",
  skeleton = false,
  ripple = false
}: LoadingSpinnerProps) {
  const [showRipple, setShowRipple] = useState(false);
  const [shouldShow, setShouldShow] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setShouldShow(true);
      setShowRipple(false);
    } else {
      // Trigger ripple effect when loading completes
      if (ripple && shouldShow) {
        setShowRipple(true);
      }
      
      // Small delay to allow ripple to start
      const timer = setTimeout(() => {
        setShouldShow(false);
        setShowRipple(false);
      }, ripple ? 100 : 0);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, ripple, shouldShow]);

  // If we're showing skeleton loading, don't block the UI
  if (skeleton && isLoading) {
    return (
      <div className={className}>
        <SkeletonLoader />
      </div>
    );
  }

  // For fullscreen loading (rare cases)
  if (fullscreen && shouldShow) {
    return (
      <>
        <div className="fixed inset-0 bg-gradient-to-br from-void-black via-charcoal-black to-void-black flex items-center justify-center z-50">
          <LoadingIndicator />
        </div>
        <RippleEffect trigger={showRipple} />
      </>
    );
  }

  // For inline loading
  if (shouldShow) {
    return (
      <>
        <LoadingIndicator className={className} />
        <RippleEffect trigger={showRipple} />
      </>
    );
  }

  return <RippleEffect trigger={showRipple} />;
}