"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import QRCodeGenerator from "./QRCodeGenerator";

export default function ContactCard() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  const contactInfo = {
    name: "Pramit Mazumder",
    email: "me@pramit.gg",
    website: "https://pramit.gg",
    phone: "7147471492", // Add if you want to include
    title: "ur new best friend",
  };

  const generateVCard = () => {
    const vCard = `BEGIN:VCARD
VERSION:3.0
FN:${contactInfo.name}
EMAIL:${contactInfo.email}
URL:${contactInfo.website}
TITLE:${contactInfo.title}
ORG:pramit.gg
NOTE:Living journal of interests, projects, and experiences
END:VCARD`;

    return new Blob([vCard], { type: "text/vcard;charset=utf-8" });
  };

  const downloadVCard = () => {
    setIsDownloading(true);

    const vCardBlob = generateVCard();
    const url = window.URL.createObjectURL(vCardBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pramit-mazumder.vcf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    setTimeout(() => setIsDownloading(false), 1000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Contact Card Preview */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="glass-dark backdrop-blur-3xl border border-white/10 rounded-3xl p-8 md:p-12 mb-8"
      >
        <div className="text-center mb-8">
          <div className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-accent-orange/20 to-accent-purple/20 border border-white/10 flex items-center justify-center">
            <span className="text-4xl md:text-5xl font-light">PM</span>
          </div>

          <h2 className="text-2xl md:text-3xl font-light text-white mb-2">
            {contactInfo.name}
          </h2>
          <p className="text-gray-400 text-lg font-light mb-4">
            {contactInfo.title}
          </p>

          <div className="space-y-3 text-gray-300">
            <div className="flex items-center justify-center gap-3">
              <svg
                className="w-5 h-5 text-accent-orange"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span className="font-light">{contactInfo.email}</span>
            </div>

            <div className="flex items-center justify-center gap-3">
              <svg
                className="w-5 h-5 text-accent-purple"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9m0 9c-5 0-9-4-9-9s4-9 9-9"
                />
              </svg>
              <span className="font-light">{contactInfo.website}</span>
            </div>
          </div>
        </div>

        {/* QR Code Toggle Button */}
        <div className="flex justify-center mb-8">
          <motion.button
            onClick={() => setShowQRCode(!showQRCode)}
            className="glass backdrop-blur-3xl border border-white/10 rounded-2xl p-4 text-white font-light hover:bg-white/5 transition-all duration-300 hover:scale-105"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex items-center justify-center gap-3">
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
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 0h.01M9 16h1m-1 4h1m4-4h1m-1 4h1m-5 0h.01M9 20h1m-1 0h1m4 0h1m-1 0h1m-5 0h.01"
                />
              </svg>
              <span>{showQRCode ? "Hide QR Code" : "Show QR Code"}</span>
            </div>
          </motion.button>
        </div>

        {/* QR Code */}
        <AnimatePresence>
          {showQRCode && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 32 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden"
            >
              <div className="flex justify-center">
                <QRCodeGenerator
                  data={`https://pramit.gg/connect`}
                  size={128}
                  className="mx-auto"
                />
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center text-gray-500 text-sm font-light mt-4"
              >
                scan to share this page
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Download Button */}
        <motion.button
          onClick={downloadVCard}
          disabled={isDownloading}
          className="w-full glass backdrop-blur-3xl border border-white/20 rounded-2xl p-4 text-white font-light hover:bg-white/10 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center justify-center gap-3">
            {isDownloading ? (
              <motion.svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </motion.svg>
            ) : (
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
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            )}
            <span>{isDownloading ? "Downloading..." : "Download Contact"}</span>
          </div>
        </motion.button>
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="text-center text-gray-400 text-sm font-light"
      >
        <p>download to instantly add me to your contacts on any device</p>
      </motion.div>
    </div>
  );
}
