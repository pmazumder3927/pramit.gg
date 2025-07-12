"use client";

import { useLoading } from '../lib/loadingContext';
import Link from 'next/link';

export default function DemoPage() {
  const { startLoading, stopLoading, isLoading } = useLoading();

  return (
    <div className="min-h-screen bg-void-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-extralight mb-8 bg-gradient-to-r from-accent-orange to-accent-red bg-clip-text text-transparent">
          Blob Loading Animation Demo
        </h1>
        
        <div className="space-y-6 glass-dark p-8 rounded-2xl border border-white/10">
          <p className="text-gray-300 mb-8">
            Experience the fluid, organic loading animation that travels with you between pages. 
            The blob enters from the left, breathes in the center, and exits smoothly to the right.
          </p>

          <div className="grid gap-4">
            <h2 className="text-2xl font-light mb-4">Manual Controls</h2>
            
            <div className="flex gap-4">
              <button
                onClick={startLoading}
                disabled={isLoading}
                className="px-6 py-3 rounded-xl bg-accent-orange/20 hover:bg-accent-orange/30 
                         border border-accent-orange/50 transition-all duration-300 
                         disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
              >
                Start Loading
              </button>
              
              <button
                onClick={stopLoading}
                disabled={!isLoading}
                className="px-6 py-3 rounded-xl bg-accent-red/20 hover:bg-accent-red/30 
                         border border-accent-red/50 transition-all duration-300 
                         disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
              >
                Stop Loading
              </button>
            </div>

            <div className="mt-8">
              <h2 className="text-2xl font-light mb-4">Navigation Demo</h2>
              <p className="text-gray-400 mb-4">
                Click these links to see the loading animation during page transitions:
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link
                  href="/"
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 
                           border border-white/20 transition-all duration-300 
                           hover:scale-105 text-center"
                >
                  Home
                </Link>
                
                <Link
                  href="/about"
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 
                           border border-white/20 transition-all duration-300 
                           hover:scale-105 text-center"
                >
                  About
                </Link>
                
                <Link
                  href="/music"
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 
                           border border-white/20 transition-all duration-300 
                           hover:scale-105 text-center"
                >
                  Music
                </Link>
                
                <Link
                  href="/connect"
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 
                           border border-white/20 transition-all duration-300 
                           hover:scale-105 text-center"
                >
                  Connect
                </Link>
              </div>
            </div>

            <div className="mt-8 p-4 bg-white/5 rounded-xl">
              <h3 className="text-lg font-light mb-2">Animation Features:</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Coordinated particle movement with flocking behavior</li>
                <li>• Organic breathing effect with harmonic oscillations</li>
                <li>• Smooth directional transitions (left → center → right)</li>
                <li>• Motion blur and streak effects during movement</li>
                <li>• Multi-layered glow with warm gradient colors</li>
                <li>• 60fps performance with requestAnimationFrame</li>
                <li>• Non-blocking, SSR-safe implementation</li>
              </ul>
            </div>

            <div className="mt-4 text-center text-gray-500">
              Loading Status: {isLoading ? '🟢 Active' : '⚪ Idle'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}