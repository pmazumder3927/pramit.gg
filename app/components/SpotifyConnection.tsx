"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";

interface SpotifyConnectionProps {
  initialSuccess?: boolean;
  initialError?: string;
}

export default function SpotifyConnection({
  initialSuccess,
  initialError,
}: SpotifyConnectionProps) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    // Show initial messages from OAuth callback
    if (initialSuccess) {
      setMessage({ type: "success", text: "Spotify connected successfully!" });
    } else if (initialError) {
      setMessage({ type: "error", text: initialError });
    }

    // Check connection status
    checkStatus();
  }, [initialSuccess, initialError]);

  const checkStatus = async () => {
    try {
      const response = await fetch("/api/spotify/status");
      const data = await response.json();
      setIsConnected(data.connected);
    } catch {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    window.location.href = "/api/spotify/auth";
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Spotify?")) return;

    setDisconnecting(true);
    try {
      const response = await fetch("/api/spotify/disconnect", {
        method: "POST",
      });

      if (response.ok) {
        setIsConnected(false);
        setMessage({ type: "success", text: "Spotify disconnected" });
      } else {
        setMessage({ type: "error", text: "Failed to disconnect" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to disconnect" });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-deep-graphite rounded-lg p-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400">Checking Spotify status...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-deep-graphite rounded-lg p-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Spotify Logo */}
          <div className="w-12 h-12 bg-[#1DB954] rounded-full flex items-center justify-center">
            <svg
              className="w-7 h-7 text-black"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </div>

          <div>
            <h3 className="font-medium text-lg">Spotify</h3>
            <p className="text-sm text-gray-400">
              {isConnected
                ? "Connected - Your music activity is being displayed"
                : "Connect to show your music activity on your site"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div
            className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-500"}`}
          />

          {isConnected ? (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : (
            <button
              onClick={handleConnect}
              className="px-4 py-2 bg-[#1DB954] text-black font-medium rounded-lg hover:bg-[#1ed760] transition-all"
            >
              Connect Spotify
            </button>
          )}
        </div>
      </div>

      {/* Message display */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-4 px-4 py-2 rounded-lg ${
            message.type === "success"
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {message.text}
        </motion.div>
      )}
    </motion.div>
  );
}
