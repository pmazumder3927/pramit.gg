"use client";

import { motion } from "motion/react";
import { useState } from "react";
import Image from "next/image";
import QRCodeGenerator from "./components/QRCodeGenerator";
import ConfessionalBooth from "./components/ConfessionalBooth";

export default function Connect() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  const contactInfo = {
    name: "Pramit Mazumder",
    email: "me@pramit.gg",
    website: "https://pramit.gg",
    title: "ur new best friend",
  };

  const socialLinks = [
    {
      name: "Instagram",
      username: "@mazoomzoom",
      url: "https://www.instagram.com/mazoomzoom/",
      color: "#E1306C",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.017 0C8.396 0 7.938.012 6.718.07 5.498.127 4.697.334 4.007.63c-.716.3-1.323.703-1.926 1.306S1.34 3.29 1.04 4.006c-.296.69-.503 1.49-.56 2.71C.422 7.936.41 8.394.41 12.015c0 3.62.012 4.078.07 5.298.057 1.22.264 2.02.56 2.71.3.715.703 1.322 1.306 1.925.603.603 1.21 1.006 1.926 1.306.69.296 1.49.503 2.71.56 1.22.058 1.678.07 5.298.07 3.62 0 4.078-.012 5.298-.07 1.22-.057 2.02-.264 2.71-.56.715-.3 1.322-.703 1.925-1.306.603-.603 1.006-1.21 1.306-1.925.296-.69.503-1.49.56-2.71.058-1.22.07-1.678.07-5.298 0-3.62-.012-4.078-.07-5.298-.057-1.22-.264-2.02-.56-2.71-.3-.715-.703-1.322-1.306-1.925C19.478.64 18.871.237 18.156-.063c-.69-.296-1.49-.503-2.71-.56C14.226.012 13.768 0 10.148 0H12.017zm-.058 2.188c3.555 0 3.976.014 5.38.072 1.297.058 2.003.27 2.47.45.622.242 1.066.532 1.532.998.466.466.756.91.998 1.532.18.467.392 1.173.45 2.47.058 1.404.072 1.825.072 5.38s-.014 3.976-.072 5.38c-.058 1.297-.27 2.003-.45 2.47-.242.622-.532 1.066-.998 1.532-.466.466-.91.756-1.532.998-.467.18-1.173.392-2.47.45-1.404.058-1.825.072-5.38.072s-3.976-.014-5.38-.072c-1.297-.058-2.003-.27-2.47-.45-.622-.242-1.066-.532-1.532-.998-.466-.466-.756-.91-.998-1.532-.18-.467-.392-1.173-.45-2.47-.058-1.404-.072-1.825-.072-5.38s.014-3.976.072-5.38c.058-1.297.27-2.003.45-2.47.242-.622.532-1.066.998-1.532.466-.466.91-.756 1.532-.998.467-.18 1.173-.392 2.47-.45 1.404-.058 1.825-.072 5.38-.072zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      ),
      isPrimary: true,
    },
    {
      name: "GitHub",
      username: "@pmazumder3927",
      url: "https://github.com/pmazumder3927",
      color: "#fff",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      ),
    },
    {
      name: "Spotify",
      username: "music taste",
      url: "/music",
      color: "#1DB954",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      ),
    },
    {
      name: "Email",
      username: "me@pramit.gg",
      url: "mailto:me@pramit.gg",
      color: "#7c77c6",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

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

  const primarySocial = socialLinks.find((link) => link.isPrimary);
  const secondarySocials = socialLinks.filter((link) => !link.isPrimary);

  return (
    <div className="min-h-screen bg-void-black">
      {/* Noise texture */}
      <div
        className="fixed inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <main className="relative z-10 min-h-screen">
        {/* Header */}
        <section className="pt-16 pb-8 md:pt-24 md:pb-12">
          <div className="max-w-4xl mx-auto px-6 md:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-extralight text-white/90 mb-4">
                connect
              </h1>
              <p className="text-lg text-white/40 font-light">
                if you&apos;re here, we&apos;re friends now
              </p>
            </motion.div>

            {/* Contact Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative mb-12"
            >
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-8 h-px bg-white/10" />
              <div className="absolute top-0 left-0 w-px h-8 bg-white/10" />
              <div className="absolute bottom-0 right-0 w-8 h-px bg-white/10" />
              <div className="absolute bottom-0 right-0 w-px h-8 bg-white/10" />

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 md:p-12">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-28 h-28 rounded-full overflow-hidden border border-white/10">
                      <Image
                        src="https://urfeanhummwzxrqvjxkm.supabase.co/storage/v1/object/public/images/uploads/1752126862158_8673ra.png"
                        alt="Pramit Mazumder"
                        width={112}
                        height={112}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="text-center md:text-left flex-1">
                    <h2 className="text-2xl font-light text-white mb-1">
                      {contactInfo.name}
                    </h2>
                    <p className="text-white/40 font-light mb-4">
                      {contactInfo.title}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 text-sm text-white/50">
                      <span>{contactInfo.email}</span>
                      <span className="hidden sm:inline">·</span>
                      <span>{contactInfo.website}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-3">
                    <motion.button
                      onClick={downloadVCard}
                      disabled={isDownloading}
                      className="px-6 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white/80 text-sm font-light hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300 disabled:opacity-50"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isDownloading ? "Downloading..." : "Add to Contacts"}
                    </motion.button>

                    <button
                      onClick={() => setShowQRCode(!showQRCode)}
                      className="px-6 py-2 text-white/40 text-sm font-light hover:text-white/60 transition-colors"
                    >
                      {showQRCode ? "Hide QR" : "Show QR"}
                    </button>
                  </div>
                </div>

                {/* QR Code */}
                {showQRCode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-8 pt-8 border-t border-white/[0.06] text-center"
                  >
                    <QRCodeGenerator
                      data="https://pramit.gg/connect"
                      size={120}
                      className="mx-auto mb-3"
                    />
                    <p className="text-white/30 text-xs font-light">
                      scan to share this page
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Social Links */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-16"
            >
              <h3 className="text-sm text-white/30 uppercase tracking-wider mb-6">
                Find me elsewhere
              </h3>

              {/* Primary Social */}
              {primarySocial && (
                <motion.a
                  href={primarySocial.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block mb-4 p-6 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-4">
                    <div className="transition-opacity opacity-80 group-hover:opacity-100" style={{ color: primarySocial.color }}>
                      {primarySocial.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-white/80 font-light">{primarySocial.name}</div>
                      <div className="text-white/40 text-sm">{primarySocial.username}</div>
                    </div>
                    <svg className="w-4 h-4 text-white/20 group-hover:text-white/40 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </motion.a>
              )}

              {/* Secondary Socials Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {secondarySocials.map((link, index) => (
                  <motion.a
                    key={link.name}
                    href={link.url}
                    target={link.url.startsWith("http") ? "_blank" : "_self"}
                    rel={link.url.startsWith("http") ? "noopener noreferrer" : ""}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.05 }}
                    className="group p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
                    whileHover={{ y: -2 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="transition-opacity opacity-70 group-hover:opacity-100" style={{ color: link.color }}>
                        {link.icon}
                      </div>
                      <div>
                        <div className="text-white/70 text-sm font-light">{link.name}</div>
                        <div className="text-white/30 text-xs">{link.username}</div>
                      </div>
                    </div>
                  </motion.a>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Confessional Section */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="pb-32"
        >
          <div className="max-w-3xl mx-auto px-6 md:px-8">
            <ConfessionalBooth />
          </div>
        </motion.section>
      </main>
    </div>
  );
}
