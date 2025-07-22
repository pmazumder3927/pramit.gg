"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface PlotlyGraphProps {
  src: string;
  title?: string;
  height?: string;
}

export default function PlotlyGraph({ src, title, height = "500px" }: PlotlyGraphProps) {
  const [showGraph, setShowGraph] = useState(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Convert Supabase URL to our proxy URL
  const getProxyUrl = (originalUrl: string) => {
    try {
      const url = new URL(originalUrl);
      // Remove the protocol and convert to our proxy path
      const pathWithoutProtocol = url.href.replace(/^https?:\/\//, '');
      return `/api/plotly/${pathWithoutProtocol}`;
    } catch {
      return originalUrl;
    }
  };

  useEffect(() => {
    if (isIframeLoaded && iframeRef.current) {
      // Send message to iframe to enable Plotly responsiveness
      try {
        iframeRef.current.contentWindow?.postMessage(
          { type: 'resize' },
          '*'
        );
      } catch (err) {
        console.error('Error communicating with iframe:', err);
      }
    }
  }, [isIframeLoaded, isExpanded]);

  const handleLoad = () => {
    setIsIframeLoaded(true);
    setError(false);
  };

  const handleError = () => {
    setError(true);
    setIsIframeLoaded(false);
  };

  return (
    <div className="my-8">
      <AnimatePresence mode="wait">
        {!showGraph && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-gradient-to-br from-charcoal-black/90 to-void-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-8"
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 relative">
                <svg
                  className="w-16 h-16 text-accent-orange animate-pulse"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-light text-white mb-2">
                  {title || "Interactive Plotly Graph"}
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Click to load interactive visualization
                </p>
                <button
                  onClick={() => setShowGraph(true)}
                  className="px-6 py-2 bg-accent-orange/20 hover:bg-accent-orange/30 text-accent-orange rounded-full transition-colors duration-200 font-medium"
                >
                  Load Graph
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showGraph && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className={`bg-gradient-to-br from-charcoal-black/90 to-void-black/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden ${
            isExpanded ? "fixed inset-4 z-50" : "relative"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-sm font-medium text-gray-300">
              {title || "Plotly Visualization"}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title={isExpanded ? "Exit fullscreen" : "Enter fullscreen"}
              >
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isExpanded ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Graph Container */}
          <div className={`relative ${isExpanded ? "h-[calc(100%-64px)]" : ""}`} style={{ height: isExpanded ? undefined : height }}>
            {/* Loading overlay */}
            {!isIframeLoaded && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-accent-orange/30 border-t-accent-orange rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600">Loading visualization...</p>
                </div>
              </div>
            )}
            
            {error ? (
              <div className="flex items-center justify-center h-full p-8">
                <div className="text-center">
                  <svg
                    className="w-12 h-12 text-red-500 mx-auto mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-gray-400">Failed to load graph</p>
                </div>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                src={getProxyUrl(src)}
                className="w-full h-full border-0 bg-white"
                onLoad={handleLoad}
                onError={handleError}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title={title || "Plotly Graph"}
              />
            )}
          </div>
        </motion.div>
      )}

      {/* Fullscreen backdrop */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}