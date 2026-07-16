"use client";

import { motion } from "motion/react";
import { useState } from "react";
import Image from "next/image";
import QRCodeGenerator from "./components/QRCodeGenerator";
import ConfessionalBooth from "./components/ConfessionalBooth";
import TurtleGallery from "./components/TurtleGallery";
import {
  Doodle,
  Stamp,
  HandNote,
  Tape,
  PaperClip,
  Polaroid,
} from "@/app/components/sketchbook";

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
      tone: "orange" as const,
      rotate: -2.5,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.017 0C8.396 0 7.938.012 6.718.07 5.498.127 4.697.334 4.007.63c-.716.3-1.323.703-1.926 1.306S1.34 3.29 1.04 4.006c-.296.69-.503 1.49-.56 2.71C.422 7.936.41 8.394.41 12.015c0 3.62.012 4.078.07 5.298.057 1.22.264 2.02.56 2.71.3.715.703 1.322 1.306 1.925.603.603 1.21 1.006 1.926 1.306.69.296 1.49.503 2.71.56 1.22.058 1.678.07 5.298.07 3.62 0 4.078-.012 5.298-.07 1.22-.057 2.02-.264 2.71-.56.715-.3 1.322-.703 1.925-1.306.603-.603 1.006-1.21 1.306-1.925.296-.69.503-1.49.56-2.71.058-1.22.07-1.678.07-5.298 0-3.62-.012-4.078-.07-5.298-.057-1.22-.264-2.02-.56-2.71-.3-.715-.703-1.322-1.306-1.925C19.478.64 18.871.237 18.156-.063c-.69-.296-1.49-.503-2.71-.56C14.226.012 13.768 0 10.148 0H12.017zm-.058 2.188c3.555 0 3.976.014 5.38.072 1.297.058 2.003.27 2.47.45.622.242 1.066.532 1.532.998.466.466.756.91.998 1.532.18.467.392 1.173.45 2.47.058 1.404.072 1.825.072 5.38s-.014 3.976-.072 5.38c-.058 1.297-.27 2.003-.45 2.47-.242.622-.532 1.066-.998 1.532-.466.466-.91.756-1.532.998-.467.18-1.173.392-2.47.45-1.404.058-1.825.072-5.38.072s-3.976-.014-5.38-.072c-1.297-.058-2.003-.27-2.47-.45-.622-.242-1.066-.532-1.532-.998-.466-.466-.756-.91-.998-1.532-.18-.467-.392-1.173-.45-2.47-.058-1.404-.072-1.825-.072-5.38s.014-3.976.072-5.38c.058-1.297.27-2.003.45-2.47.242-.622.532-1.066.998-1.532.466-.466.91-.756 1.532-.998.467-.18 1.173-.392 2.47-.45 1.404-.058 1.825-.072 5.38-.072zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      ),
    },
    {
      name: "GitHub",
      username: "@pmazumder3927",
      url: "https://github.com/pmazumder3927",
      tone: "ink" as const,
      rotate: 2,
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
      tone: "purple" as const,
      rotate: -1.5,
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
      tone: "rust" as const,
      rotate: 1.5,
      icon: (
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
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
  ];

  const toneColor: Record<string, string> = {
    orange: "rgb(var(--accent-orange))",
    purple: "rgb(var(--accent-purple))",
    rust: "rgb(var(--accent-rust))",
    ink: "rgb(var(--fg))",
  };

  const generateVCard = () => {
    const vCard = `BEGIN:VCARD
VERSION:3.0
FN:${contactInfo.name}
EMAIL:${contactInfo.email}
URL:${contactInfo.website}
TITLE:${contactInfo.title}
ORG:pramit.gg
NOTE:pramit mazumder that one really cool guy with a blog
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
    <div className="min-h-screen pb-6 md:pb-16">
      <main className="relative z-10">
        {/* ============ GREETING — a handwritten salutation across the page ============ */}
        <section className="pt-16 md:pt-24">
          <div className="mx-auto max-w-4xl px-6 md:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="flex items-center gap-3">
                <HandNote tone="rust" rotate={-4} className="text-3xl">
                  dear stranger,
                </HandNote>
                <Doodle
                  name="arrow"
                  tone="orange"
                  className="h-6 w-12"
                  strokeWidth={3}
                  draw
                />
              </div>

              <h1 className="relative mt-1 inline-block font-serif text-5xl font-medium tracking-tight text-ink md:text-7xl lg:text-8xl">
                say hello
                <Doodle
                  name="underline"
                  tone="orange"
                  className="absolute -bottom-3 left-0 h-4 w-[105%]"
                  strokeWidth={4}
                  draw
                />
                <Doodle
                  name="star"
                  tone="purple"
                  className="absolute -right-8 -top-2 h-7 w-7 md:-right-12"
                  strokeWidth={2}
                />
              </h1>

              <p className="mt-7 max-w-xl font-serif text-lg italic leading-relaxed text-ink-soft">
                if ur reading this we&apos;re best friends now
              </p>
            </motion.div>
          </div>
        </section>

        {/* ============ THE SPREAD — calling card pinned beside the stamps ============ */}
        <section className="pt-12 md:pt-16">
          <div className="mx-auto max-w-5xl px-6 md:px-8">
            <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-start md:gap-8">
              {/* --- the calling card (taped polaroid) --- */}
              <motion.div
                initial={{ opacity: 0, y: 30, rotate: -3 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="relative mx-auto w-full max-w-xs md:mx-0"
              >
                <HandNote
                  tone="purple"
                  rotate={-6}
                  className="absolute -left-2 -top-9 z-30 text-2xl md:-left-6"
                >
                  ↓ that&apos;s me
                </HandNote>

                <Polaroid
                  rotate={-2.5}
                  tone="orange"
                  caption={<span>dashing really cool guy</span>}
                  className="w-full"
                >
                  <div className="aspect-square w-full">
                    <Image
                      src="/me.jpg"
                      alt="Pramit Mazumder"
                      width={320}
                      height={320}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </Polaroid>

                {/* the name plate, clipped under the photo */}
                <div className="relative mx-auto mt-5 max-w-[15rem] rotate-[1.2deg] rounded-[3px] border border-line bg-card px-4 py-3 shadow-paper">
                  <PaperClip
                    className="-right-2 -top-4"
                    rotate={12}
                    tone="ink"
                    size={30}
                  />
                  <h2 className="font-serif text-xl font-medium leading-tight text-ink">
                    {contactInfo.name}
                  </h2>
                  <p className="font-hand text-lg text-accent-rust">
                    {contactInfo.title}
                  </p>
                  <div className="mt-2 space-y-0.5 font-mono text-[0.7rem] text-ink-soft">
                    <div>{contactInfo.email}</div>
                    <div>{contactInfo.website}</div>
                  </div>

                  <div className="mt-3 flex items-center gap-3 border-t border-dashed border-line pt-3">
                    <motion.button
                      onClick={downloadVCard}
                      disabled={isDownloading}
                      className="btn-sketch btn-sketch-solid !px-3 !py-1.5 !text-xs disabled:opacity-50"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {isDownloading ? "saving..." : "+ to contacts"}
                    </motion.button>
                    <button
                      onClick={() => setShowQRCode(!showQRCode)}
                      className="font-hand text-base text-ink-faint underline decoration-dashed decoration-line underline-offset-4 transition-colors hover:text-accent-orange"
                    >
                      {showQRCode ? "hide qr" : "show qr"}
                    </button>
                  </div>
                </div>

                {/* QR — a little stamp you scan */}
                {showQRCode && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, rotate: 6 }}
                    animate={{ opacity: 1, scale: 1, rotate: 3 }}
                    className="relative mx-auto mt-5 w-fit"
                  >
                    <Tape
                      tone="purple"
                      rotate={-8}
                      className="-top-3 left-1/2 -translate-x-1/2"
                    />
                    <QRCodeGenerator
                      data="https://pramit.gg/connect"
                      size={112}
                    />
                    <p className="mt-1 text-center font-hand text-sm text-ink-faint">
                      scan to keep me
                    </p>
                  </motion.div>
                )}
              </motion.div>

              {/* --- the about note + scattered social stamps --- */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
              >
                {/* the introduction note, on a torn-feeling sheet */}
                <div className="relative -rotate-[0.6deg] rounded-[3px] border border-line bg-card px-6 py-6 shadow-paper md:px-7">
                  <Tape tone="rust" rotate={-5} className="-top-3 left-8" />
                  <HandNote tone="orange" rotate={-2} className="text-xl">
                    a quick note about me —
                  </HandNote>
                  <div className="mt-2 space-y-3 font-serif text-base leading-relaxed text-ink-soft">
                    <p>
                      this is a place where i share things i think are cool. i
                      believe in building things that feel personal and alive;
                      this whole site is an experiment in that philosophy.
                    </p>
                    <p className="text-ink-faint">
                      lately: reinforcement learning, robotics, bouldering,
                      electronic music, and optimizing my life a little too
                      much.
                    </p>
                  </div>
                </div>

                {/* social stamps, scattered */}
                <div className="relative mt-9">
                  <div className="mb-4 flex items-center gap-2">
                    <HandNote tone="orange" rotate={-2} className="text-2xl">
                      find me elsewhere
                    </HandNote>
                    <Doodle
                      name="squiggle"
                      tone="purple"
                      className="h-4 w-16"
                      strokeWidth={2.5}
                    />
                  </div>

                  <div className="flex flex-wrap items-start gap-x-4 gap-y-5">
                    {socialLinks.map((link, index) => (
                      <motion.a
                        key={link.name}
                        href={link.url}
                        target={
                          link.url.startsWith("http") ? "_blank" : "_self"
                        }
                        rel={
                          link.url.startsWith("http")
                            ? "noopener noreferrer"
                            : ""
                        }
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.4,
                          delay: 0.3 + index * 0.06,
                        }}
                        whileHover={{
                          y: -4,
                          rotate:
                            link.rotate > 0 ? link.rotate - 2 : link.rotate + 2,
                          scale: 1.04,
                        }}
                        className="group relative inline-flex items-center gap-2.5 rounded-[5px] border-[1.6px] bg-card px-3.5 py-2 shadow-paper transition-shadow hover:shadow-paper-lg"
                        style={{
                          transform: `rotate(${link.rotate}deg)`,
                          borderColor: "rgb(var(--line))",
                        }}
                      >
                        <Tape
                          tone={link.tone}
                          rotate={index % 2 ? 6 : -6}
                          width={40}
                          className="-top-2.5 left-1/2 -translate-x-1/2"
                        />
                        <span style={{ color: toneColor[link.tone] }}>
                          {link.icon}
                        </span>
                        <span className="flex flex-col leading-tight">
                          <span className="font-serif text-sm font-medium text-ink">
                            {link.name}
                          </span>
                          <span className="font-hand text-sm text-accent-rust">
                            {link.username}
                          </span>
                        </span>
                      </motion.a>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============ divider doodle ============ */}
        <div className="my-16 flex items-center justify-center gap-3 md:my-20">
          <Doodle
            name="divider"
            tone="rust"
            className="h-5 w-44 md:w-64"
            strokeWidth={2.5}
          />
        </div>

        {/* ============ Confessional / leave a doodle ============ */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="mx-auto max-w-3xl px-6 md:px-8">
            <ConfessionalBooth />
          </div>
        </motion.section>

        {/* ============ divider doodle ============ */}
        <div className="my-16 flex items-center justify-center gap-3 md:my-20">
          <Doodle
            name="star"
            tone="orange"
            className="h-4 w-4"
            strokeWidth={2}
          />
          <Doodle
            name="divider"
            tone="purple"
            className="h-5 w-40 md:w-56"
            strokeWidth={2.5}
          />
          <Doodle
            name="star"
            tone="purple"
            className="h-4 w-4"
            strokeWidth={2}
          />
        </div>

        {/* ============ Turtle Gallery — the doodle wall ============ */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="mx-auto max-w-5xl px-6 md:px-8">
            <TurtleGallery />
          </div>
        </motion.section>
      </main>
    </div>
  );
}
