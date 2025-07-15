"use client";

import { motion } from "motion/react";
import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";

interface QRCodeGeneratorProps {
  data?: string;
  size?: number;
  className?: string;
}

export default function QRCodeGenerator({
  data = "https://pramit.gg",
  size = 128,
  className = "",
}: QRCodeGeneratorProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const generateQRCode = useCallback(async () => {
    setIsLoading(true);
    try {
      // Generate actual QR code using the qrcode library
      const qrCodeDataUrl = await QRCode.toDataURL(data, {
        width: size,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      setQrCodeDataUrl(qrCodeDataUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
    } finally {
      setIsLoading(false);
    }
  }, [data, size]);

  useEffect(() => {
    generateQRCode();
  }, [generateQRCode]);

  if (isLoading) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl`}
        style={{ width: size, height: size }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={`${className} overflow-hidden rounded-2xl border border-white/10`}
      style={{ width: size, height: size }}
    >
      {qrCodeDataUrl ? (
        <img
          src={qrCodeDataUrl}
          alt="QR Code"
          className="w-full h-full object-cover"
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <div className="w-full h-full bg-white/5 flex items-center justify-center">
          <span className="text-gray-500 text-xs">QR Error</span>
        </div>
      )}
    </motion.div>
  );
}
