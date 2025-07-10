"use client";

import { motion } from "framer-motion";

export default function SocialLinks() {
  const socialLinks = [
    {
      name: "Instagram",
      username: "@mazoomzoom",
      url: "https://www.instagram.com/mazoomzoom/",
      color: "from-accent-pink to-accent-purple",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.017 0C8.396 0 7.938.012 6.718.07 5.498.127 4.697.334 4.007.63c-.716.3-1.323.703-1.926 1.306S1.34 3.29 1.04 4.006c-.296.69-.503 1.49-.56 2.71C.422 7.936.41 8.394.41 12.015c0 3.62.012 4.078.07 5.298.057 1.22.264 2.02.56 2.71.3.715.703 1.322 1.306 1.925.603.603 1.21 1.006 1.926 1.306.69.296 1.49.503 2.71.56 1.22.058 1.678.07 5.298.07 3.62 0 4.078-.012 5.298-.07 1.22-.057 2.02-.264 2.71-.56.715-.3 1.322-.703 1.925-1.306.603-.603 1.006-1.21 1.306-1.925.296-.69.503-1.49.56-2.71.058-1.22.07-1.678.07-5.298 0-3.62-.012-4.078-.07-5.298-.057-1.22-.264-2.02-.56-2.71-.3-.715-.703-1.322-1.306-1.925C19.478.64 18.871.237 18.156-.063c-.69-.296-1.49-.503-2.71-.56C14.226.012 13.768 0 10.148 0H12.017zm-.058 2.188c3.555 0 3.976.014 5.38.072 1.297.058 2.003.27 2.47.45.622.242 1.066.532 1.532.998.466.466.756.91.998 1.532.18.467.392 1.173.45 2.47.058 1.404.072 1.825.072 5.38s-.014 3.976-.072 5.38c-.058 1.297-.27 2.003-.45 2.47-.242.622-.532 1.066-.998 1.532-.466.466-.91.756-1.532.998-.467.18-1.173.392-2.47.45-1.404.058-1.825.072-5.38.072s-3.976-.014-5.38-.072c-1.297-.058-2.003-.27-2.47-.45-.622-.242-1.066-.532-1.532-.998-.466-.466-.756-.91-.998-1.532-.18-.467-.392-1.173-.45-2.47-.058-1.404-.072-1.825-.072-5.38s.014-3.976.072-5.38c.058-1.297.27-2.003.45-2.47.242-.622.532-1.066.998-1.532.466-.466.91-.756 1.532-.998.467-.18 1.173-.392 2.47-.45 1.404-.058 1.825-.072 5.38-.072zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      ),
    },
    {
      name: "GitHub",
      username: "@pmazumder3927",
      url: "https://github.com/pmazumder3927",
      color: "from-gray-400 to-white",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      ),
    },
    {
      name: "Spotify",
      username: "music taste",
      url: "/music",
      color: "from-accent-green to-accent-blue",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      ),
    },
    {
      name: "Email",
      username: "me@pramit.gg",
      url: "mailto:me@pramit.gg",
      color: "from-accent-orange to-accent-yellow",
      icon: (
        <svg
          className="w-6 h-6"
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

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h2 className="text-2xl md:text-3xl font-light text-white mb-4">
          follow the journey
        </h2>
        <p className="text-gray-400 font-light max-w-md mx-auto">
          stay connected across platforms where i share different facets of life
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {socialLinks.map((link, index) => (
          <motion.a
            key={link.name}
            href={link.url}
            target={link.url.startsWith("http") ? "_blank" : "_self"}
            rel={link.url.startsWith("http") ? "noopener noreferrer" : ""}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.6,
              delay: index * 0.1,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            className="group relative glass-dark backdrop-blur-3xl border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-500 hover:scale-105 card-hover"
            whileHover={{ y: -8 }}
          >
            {/* Gradient background on hover */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity duration-500`}
            />

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`p-3 rounded-2xl bg-gradient-to-br ${link.color} bg-opacity-10 group-hover:bg-opacity-20 transition-all duration-300`}
                >
                  <div className="text-white">{link.icon}</div>
                </div>
                <div>
                  <h3 className="text-xl font-light text-white group-hover:text-white transition-colors duration-300">
                    {link.name}
                  </h3>
                  <p className="text-gray-400 font-light text-sm">
                    {link.username}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-sm font-light">
                  tap to {link.name === "Email" ? "contact" : "follow"}
                </span>
                <svg
                  className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </div>
            </div>
          </motion.a>
        ))}
      </div>

      {/* Additional note */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="text-center mt-12 text-gray-500 text-sm font-light"
      >
        <p>each platform shows a different angle of the same story</p>
      </motion.div>
    </div>
  );
}
