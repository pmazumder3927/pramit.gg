"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface LoadingSpinnerProps {
  isLoading: boolean;
  fullscreen?: boolean;
  className?: string;
  type?: 'navigation' | 'content';
}

// Planet configuration for the solar system
const planets = [
  { size: 8, color: '#ff6b3d', distance: 30, speed: 2, name: 'mercury' },
  { size: 12, color: '#4a9eff', distance: 45, speed: 1.5, name: 'venus' },
  { size: 10, color: '#30d158', distance: 60, speed: 1.2, name: 'earth' },
  { size: 6, color: '#ff375f', distance: 75, speed: 0.8, name: 'mars' },
  { size: 16, color: '#ffd60a', distance: 95, speed: 0.6, name: 'jupiter' },
  { size: 14, color: '#7c77c6', distance: 115, speed: 0.4, name: 'saturn' },
  { size: 8, color: '#64d2ff', distance: 135, speed: 0.3, name: 'uranus' },
  { size: 8, color: '#5e5ce6', distance: 155, speed: 0.2, name: 'neptune' },
];

export default function LoadingSpinner({ 
  isLoading, 
  fullscreen = false, 
  className = "",
  type = 'content'
}: LoadingSpinnerProps) {
  const [isFinishing, setIsFinishing] = useState(false);
  const [shouldShow, setShouldShow] = useState(isLoading);
  const [expandingPlanets, setExpandingPlanets] = useState<number[]>([]);

  useEffect(() => {
    if (isLoading) {
      setShouldShow(true);
      setIsFinishing(false);
      setExpandingPlanets([]);
    } else {
      // Start finishing sequence
      setIsFinishing(true);
      
      // Create randomized planet expansion sequence
      const shuffledIndices = Array.from({ length: planets.length }, (_, i) => i).sort(() => Math.random() - 0.5);
      
      shuffledIndices.forEach((index, i) => {
        setTimeout(() => {
          setExpandingPlanets((prev: number[]) => [...prev, index]);
        }, i * (50 + Math.random() * 100)); // Random delay between 50-150ms
      });
      
      // Keep showing until animation completes
      const timer = setTimeout(() => {
        setShouldShow(false);
        setIsFinishing(false);
        setExpandingPlanets([]);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!shouldShow) return null;

  const containerClass = fullscreen 
    ? "fixed inset-0 bg-gradient-to-br from-void-black via-charcoal-black to-void-black flex items-center justify-center z-50" 
    : "flex items-center justify-center relative";

  return (
    <div className={`${containerClass} ${className}`}>
      <div className="relative">
        {/* Central Sun */}
        <motion.div
          animate={{ 
            scale: isFinishing ? [1, 1.5, 0] : [1, 1.1, 1],
            opacity: isFinishing ? [1, 0.8, 0] : [0.9, 1, 0.9],
            rotate: 360
          }}
          transition={{ 
            scale: isFinishing ? { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] } : { duration: 3, repeat: Infinity, ease: "easeInOut" },
            opacity: isFinishing ? { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] } : { duration: 3, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 8, repeat: Infinity, ease: "linear" }
          }}
          className="absolute top-1/2 left-1/2 w-6 h-6 transform -translate-x-1/2 -translate-y-1/2 z-10"
        >
          <div className="w-full h-full bg-gradient-to-r from-accent-orange to-accent-yellow rounded-full shadow-lg" />
          <div className="absolute inset-0 bg-gradient-to-r from-accent-orange to-accent-yellow rounded-full blur-sm opacity-50" />
        </motion.div>

        {/* Orbital Paths */}
        {planets.map((planet, index) => (
          <motion.div
            key={`orbit-${index}`}
            className="absolute top-1/2 left-1/2 border border-white/10 rounded-full"
            style={{
              width: planet.distance * 2,
              height: planet.distance * 2,
              marginLeft: -planet.distance,
              marginTop: -planet.distance,
            }}
            initial={{ opacity: 0.3 }}
            animate={{ 
              opacity: isFinishing ? 0 : [0.1, 0.3, 0.1],
            }}
            transition={{ 
              opacity: isFinishing ? { duration: 0.5 } : { duration: 4, repeat: Infinity, ease: "easeInOut" },
            }}
          />
        ))}

        {/* Planets */}
        {planets.map((planet, index) => {
          const isExpanding = expandingPlanets.includes(index);
          
          return (
            <motion.div
              key={`planet-${index}`}
              className="absolute top-1/2 left-1/2"
              style={{
                width: planet.distance * 2,
                height: planet.distance * 2,
                marginLeft: -planet.distance,
                marginTop: -planet.distance,
              }}
              animate={{
                rotate: isFinishing ? 0 : 360,
              }}
              transition={{
                duration: planet.speed * 10,
                repeat: isFinishing ? 0 : Infinity,
                ease: "linear",
              }}
            >
              <motion.div
                className="absolute top-0 left-1/2 transform -translate-x-1/2 rounded-full"
                style={{
                  width: planet.size,
                  height: planet.size,
                  backgroundColor: planet.color,
                  marginTop: -planet.size / 2,
                }}
                animate={isExpanding ? {
                  scale: [1, 8, 20],
                  opacity: [1, 0.6, 0],
                  x: [0, (Math.random() - 0.5) * 200],
                  y: [0, (Math.random() - 0.5) * 200],
                } : {
                  scale: [1, 1.2, 1],
                  opacity: [0.8, 1, 0.8],
                }}
                transition={isExpanding ? {
                  duration: 1.2 + Math.random() * 0.6,
                  ease: [0.25, 0.1, 0.25, 1],
                } : {
                  duration: 2 + Math.random() * 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {/* Planet surface details */}
                <div className="absolute inset-0 rounded-full opacity-30">
                  <div 
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 70%)`,
                    }}
                  />
                </div>
                
                {/* Planet glow */}
                <div 
                  className="absolute inset-0 rounded-full blur-sm opacity-50"
                  style={{
                    backgroundColor: planet.color,
                    transform: 'scale(1.5)',
                  }}
                />
                
                {/* Some planets have moons */}
                {(index === 2 || index === 4 || index === 5) && !isExpanding && (
                  <motion.div
                    className="absolute w-2 h-2 bg-gray-400 rounded-full"
                    style={{
                      top: '50%',
                      left: '50%',
                      marginTop: -1,
                      marginLeft: -1,
                    }}
                    animate={{
                      x: [planet.size + 4, planet.size + 4],
                      y: [0, 0],
                      rotate: 360,
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                )}
              </motion.div>
            </motion.div>
          );
        })}

        {/* Constellation effect - connecting lines that appear briefly */}
        {!isFinishing && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              opacity: [0, 0.2, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              repeatDelay: 3,
            }}
          >
            <svg className="w-full h-full">
              {planets.slice(0, 4).map((planet, index) => {
                const nextIndex = (index + 1) % 4;
                const x1 = 150 + Math.cos((index * 90) * Math.PI / 180) * planet.distance;
                const y1 = 150 + Math.sin((index * 90) * Math.PI / 180) * planet.distance;
                const x2 = 150 + Math.cos((nextIndex * 90) * Math.PI / 180) * planets[nextIndex].distance;
                const y2 = 150 + Math.sin((nextIndex * 90) * Math.PI / 180) * planets[nextIndex].distance;
                
                return (
                  <line
                    key={`constellation-${index}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                  />
                );
              })}
            </svg>
          </motion.div>
        )}

        {/* Ambient space glow */}
        <motion.div 
          animate={{ 
            scale: isFinishing ? [1, 2, 0] : [1, 1.2, 1],
            opacity: isFinishing ? [0.3, 0.1, 0] : [0.1, 0.3, 0.1]
          }}
          transition={{ 
            duration: isFinishing ? 1.5 : 6,
            repeat: isFinishing ? 0 : Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 m-auto w-80 h-80 bg-gradient-to-r from-accent-orange/5 to-accent-purple/5 rounded-full blur-3xl -z-10"
        />
      </div>
    </div>
  );
}