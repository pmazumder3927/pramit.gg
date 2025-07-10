"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function ConfessionalBooth() {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);

  const maxLength = 500;

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setMessage(value);
      setCharacterCount(value.length);
    }
  };

  const submitMessage = async () => {
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Submit to API endpoint
      const response = await fetch("/api/confessional", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message.trim(),
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setIsSubmitted(true);
        setMessage("");
        setCharacterCount(0);

        // Reset after 3 seconds
        setTimeout(() => {
          setIsSubmitted(false);
        }, 3000);
      }
    } catch (error) {
      console.error("Error submitting message:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative"
      >
        {/* Confessional Booth Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-accent-purple/20 to-accent-orange/20 border border-white/10 mb-4">
              <span className="text-3xl">🤫</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-light text-white mb-2">
              whisper into the void
            </h2>
            <p className="text-gray-400 font-light max-w-md mx-auto">
              share anonymous thoughts, feedback, or just say hi. completely
              private, no traces left behind.
            </p>
          </motion.div>
        </div>

        {/* Confessional Interface */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="glass-dark backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden"
        >
          {/* Confession screen effect */}
          <div className="relative h-2 bg-gradient-to-r from-accent-purple/30 via-accent-orange/30 to-accent-purple/30">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </div>

          <div className="p-8 md:p-12">
            <AnimatePresence mode="wait">
              {!isSubmitted ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Message Input */}
                  <div className="relative">
                    <textarea
                      value={message}
                      onChange={handleMessageChange}
                      placeholder="speak your truth..."
                      className="w-full h-32 bg-transparent border border-white/10 rounded-2xl p-4 text-white placeholder-gray-500 resize-none focus:border-white/30 focus:outline-none transition-colors duration-300 font-light"
                      style={{
                        backgroundImage:
                          "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)",
                      }}
                    />

                    {/* Character count */}
                    <div className="absolute bottom-3 right-3 text-xs text-gray-500">
                      {characterCount}/{maxLength}
                    </div>
                  </div>

                  {/* Anonymity reminder */}
                  <div className="flex items-center gap-3 text-gray-500 text-sm">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <span className="font-light">
                      completely anonymous • no ip tracking • no data stored
                    </span>
                  </div>

                  {/* Submit Button */}
                  <motion.button
                    onClick={submitMessage}
                    disabled={!message.trim() || isSubmitting}
                    className="w-full glass backdrop-blur-3xl border border-white/20 rounded-2xl p-4 text-white font-light hover:bg-white/10 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: message.trim() ? 1.02 : 1 }}
                    whileTap={{ scale: message.trim() ? 0.98 : 1 }}
                  >
                    <div className="flex items-center justify-center gap-3">
                      {isSubmitting ? (
                        <>
                          <motion.svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </motion.svg>
                          <span>sending into the void...</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                          </svg>
                          <span>whisper away</span>
                        </>
                      )}
                    </div>
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center py-12"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: 0.2,
                      duration: 0.5,
                      ease: [0.25, 0.1, 0.25, 1],
                    }}
                    className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-accent-green/20 to-accent-blue/20 border border-white/10 flex items-center justify-center"
                  >
                    <svg
                      className="w-8 h-8 text-accent-green"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </motion.div>

                  <h3 className="text-xl font-light text-white mb-2">
                    message received
                  </h3>
                  <p className="text-gray-400 font-light">
                    your words have been whispered into the digital void
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Ambient effects */}
        <div className="absolute -inset-4 opacity-20 pointer-events-none">
          <motion.div
            className="absolute top-0 left-1/4 w-32 h-32 bg-accent-purple/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-0 right-1/4 w-32 h-32 bg-accent-orange/10 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.5, 0.3, 0.5],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
