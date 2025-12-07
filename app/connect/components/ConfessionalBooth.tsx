"use client";

import { motion, AnimatePresence } from "motion/react";
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
    <div className="relative">
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-8 h-px bg-white/10" />
      <div className="absolute top-0 left-0 w-px h-8 bg-white/10" />
      <div className="absolute bottom-0 right-0 w-8 h-px bg-white/10" />
      <div className="absolute bottom-0 right-0 w-px h-8 bg-white/10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h2 className="text-2xl md:text-3xl font-extralight text-white/80 mb-2">
          whisper into the void
        </h2>
        <p className="text-white/40 font-light text-sm max-w-md mx-auto">
          anonymous thoughts, feedback, or just say hi
        </p>
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 md:p-8"
            >
              {/* Message Input */}
              <div className="relative mb-4">
                <textarea
                  value={message}
                  onChange={handleMessageChange}
                  placeholder="speak your truth..."
                  className="w-full h-32 bg-transparent border border-white/[0.08] rounded-xl p-4 text-white/80 placeholder-white/30 resize-none focus:border-white/20 focus:outline-none transition-colors duration-300 font-light text-sm"
                />
                <div className="absolute bottom-3 right-3 text-xs text-white/30">
                  {characterCount}/{maxLength}
                </div>
              </div>

              {/* Anonymity note */}
              <div className="flex items-center gap-2 text-white/30 text-xs mb-6">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>completely anonymous · no tracking</span>
              </div>

              {/* Submit Button */}
              <motion.button
                onClick={submitMessage}
                disabled={!message.trim() || isSubmitting}
                className="w-full py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white/70 text-sm font-light hover:bg-white/[0.08] hover:text-white/90 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                whileHover={{ scale: message.trim() ? 1.01 : 1 }}
                whileTap={{ scale: message.trim() ? 0.99 : 1 }}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      ↻
                    </motion.span>
                    sending...
                  </span>
                ) : (
                  "whisper away"
                )}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-12 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="w-12 h-12 mx-auto mb-4 rounded-full border border-white/10 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>

              <h3 className="text-lg font-light text-white/80 mb-1">
                message received
              </h3>
              <p className="text-white/40 text-sm font-light">
                whispered into the void
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
