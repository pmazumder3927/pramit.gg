"use client";

import Image from "next/image";
import { motion } from "motion/react";

type AnimatedHeroProps = {
  banner?: {
    image_url: string;
    sketch_count: number;
  } | null;
};

export default function AnimatedHero({ banner }: AnimatedHeroProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative pt-20 pb-6 md:pt-32 md:pb-10"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        {banner ? (
          <motion.div
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 1.2,
              delay: 0.1,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            className="relative mb-10 overflow-hidden rounded-3xl border border-white/10 shadow-[0_30px_120px_-40px_rgba(120,119,198,0.4)]"
          >
            <div className="relative aspect-[3/2] md:aspect-[3/1]">
              <Image
                src={banner.image_url}
                alt="a banner woven from every sketch left in the confessional"
                fill
                priority
                sizes="(min-width: 1280px) 1280px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
              <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 text-[10px] md:text-xs uppercase tracking-[0.32em] text-white/40">
                woven from {banner.sketch_count} sketch
                {banner.sketch_count === 1 ? "" : "es"} in the confessional
              </div>
            </div>
          </motion.div>
        ) : null}

        <div className="text-center">
          <motion.h1
            className="text-5xl md:text-7xl lg:text-8xl font-extralight tracking-tight mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 1,
              delay: 0.2,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              pramit mazumder
            </span>
          </motion.h1>
          <motion.p
            className="text-xl md:text-2xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.4,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            a journal of interests, projects, and experiences
          </motion.p>
        </div>
      </div>
    </motion.section>
  );
}
