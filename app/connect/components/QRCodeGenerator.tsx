"use client";

import { motion } from "motion/react";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
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
        className={`${className} flex items-center justify-center rounded-xl border-[1.6px] border-line bg-card`}
        style={{ width: size, height: size }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-6 w-6 rounded-full border-2 border-accent-orange/60 border-t-transparent"
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={`${className} overflow-hidden rounded-xl border-[1.6px] border-ink/70 bg-pure-white p-1.5 shadow-paper`}
      style={{ width: size, height: size }}
    >
      {qrCodeDataUrl ? (
        <Image
          src={qrCodeDataUrl}
          alt="QR Code"
          width={size}
          height={size}
          className="h-full w-full object-cover"
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-card">
          <span className="text-xs text-ink-faint">QR Error</span>
        </div>
      )}
    </motion.div>
  );
}
