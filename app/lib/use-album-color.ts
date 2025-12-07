"use client";

import { useState, useEffect, useRef } from "react";

const DEFAULT_COLOR = "#ff6b3d"; // accent-orange
const colorCache = new Map<string, string>();

// Extract dominant color from an image URL using canvas
export function useAlbumColor(imageUrl: string | null): string {
  const [color, setColor] = useState(DEFAULT_COLOR);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setColor(DEFAULT_COLOR);
      return;
    }

    // Check cache first
    if (colorCache.has(imageUrl)) {
      setColor(colorCache.get(imageUrl)!);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    imgRef.current = img;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Sample a small area for performance
        const sampleSize = 50;
        canvas.width = sampleSize;
        canvas.height = sampleSize;

        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

        // Find the most vibrant color (highest saturation * brightness)
        let bestColor = { r: 255, g: 107, b: 61 };
        let bestScore = 0;

        // Sample every 4th pixel for performance
        for (let i = 0; i < imageData.length; i += 16) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];

          // Skip very dark or very light colors
          const brightness = (r + g + b) / 3;
          if (brightness < 30 || brightness > 225) continue;

          // Calculate saturation
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;

          // Score = saturation * brightness (prefer vibrant mid-tones)
          const score = saturation * (brightness / 255) * (1 - Math.abs(brightness - 127) / 127);

          if (score > bestScore) {
            bestScore = score;
            bestColor = { r, g, b };
          }
        }

        const hex = `#${bestColor.r.toString(16).padStart(2, "0")}${bestColor.g.toString(16).padStart(2, "0")}${bestColor.b.toString(16).padStart(2, "0")}`;

        colorCache.set(imageUrl, hex);
        setColor(hex);
      } catch {
        setColor(DEFAULT_COLOR);
      }
    };

    img.onerror = () => {
      setColor(DEFAULT_COLOR);
    };

    img.src = imageUrl;

    return () => {
      imgRef.current = null;
    };
  }, [imageUrl]);

  return color;
}

// Get color synchronously from cache (useful for SSR or initial render)
export function getCachedColor(imageUrl: string | null): string {
  if (!imageUrl) return DEFAULT_COLOR;
  return colorCache.get(imageUrl) || DEFAULT_COLOR;
}

// Preload colors for a list of image URLs
export function preloadColors(imageUrls: (string | null)[]): void {
  imageUrls.forEach((url) => {
    if (url && !colorCache.has(url)) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          const sampleSize = 50;
          canvas.width = sampleSize;
          canvas.height = sampleSize;
          ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

          const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
          let bestColor = { r: 255, g: 107, b: 61 };
          let bestScore = 0;

          for (let i = 0; i < imageData.length; i += 16) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            const brightness = (r + g + b) / 3;
            if (brightness < 30 || brightness > 225) continue;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = max === 0 ? 0 : (max - min) / max;
            const score = saturation * (brightness / 255) * (1 - Math.abs(brightness - 127) / 127);

            if (score > bestScore) {
              bestScore = score;
              bestColor = { r, g, b };
            }
          }

          const hex = `#${bestColor.r.toString(16).padStart(2, "0")}${bestColor.g.toString(16).padStart(2, "0")}${bestColor.b.toString(16).padStart(2, "0")}`;
          colorCache.set(url, hex);
        } catch {
          // Silently fail
        }
      };
      img.src = url;
    }
  });
}
