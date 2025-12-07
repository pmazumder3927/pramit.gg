"use client";

import { motion } from "motion/react";

export default function AnimatedHero() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative pt-20 pb-6 md:pt-32 md:pb-10"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-8">
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
            a living, evolving journal of interests, projects, and experiences
          </motion.p>
        </div>
      </div>
    </motion.section>
  );
}
