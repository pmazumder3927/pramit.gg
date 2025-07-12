'use client';

import React, { useEffect, useRef, useState } from 'react';

interface BlobLoaderProps {
  /**
   * Whether the loader should be visible / animating.
   */
  active: boolean;
}

/**
 * BlobLoader – A fluid, organic looking page-transition loader.
 * Renders a canvas that fills the viewport and animates ~80 particles
 * in a coordinated "blob" formation:
 *  1. Enters from the left edge.
 *  2. Breathes in place while loading.
 *  3. Exits smoothly to the right with subtle motion-blur streaks.
 *
 * All drawing is performed inside requestAnimationFrame so the component
 * never blocks the main thread for long and remains perfectly synced to
 * the browser’s refresh rate (usually 60 fps).
 *
 * The component itself is **client-side only** – it returns `null` during
 * SSR to keep things safe for the edge/runtime.
 */
export default function BlobLoader({ active }: BlobLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationId = useRef<number>();
  const devicePixelRatioRef = useRef(1);
  const [fps, setFps] = useState(60);
  const fpsDataRef = useRef<{ last: number; frames: number }>({ last: 0, frames: 0 });

  // Simple state machine handled through refs so we don’t re-render
  const phaseRef = useRef<'idle' | 'enter' | 'pause' | 'exit'>('idle');
  const startedAtRef = useRef<number>(0);

  // Inform canvas drawing loop when to start exit phase
  const shouldExitRef = useRef(false);

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t: number) => t * t * t;

  // Gaussian sampling via Box-Muller
  const gaussian = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random(); // avoid 0
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  /* ------------------------------------------------------------------ */
  /* Particle Setup                                                     */
  /* ------------------------------------------------------------------ */

  interface Particle {
    baseRadius: number; // radius from centre (static)
    angle: number;      // base angle around centre (static)
    offsetPhase: number;// unique phase offset for breathing
  }

  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<{ x: number; y: number }[]>([]); // for motion streaks

  /**
   * Initialise particles only once.
   */
  const initParticles = (blobRadius: number, count = 80) => {
    const parts: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const g = gaussian() * 0.15; // small variance around 0
      const r = blobRadius * (0.6 + g); // gaussian clustered near 0.6r
      const angle = Math.random() * Math.PI * 2;
      parts.push({ baseRadius: r, angle, offsetPhase: Math.random() * Math.PI * 2 });
    }
    particlesRef.current = parts;
  };

  /* ------------------------------------------------------------------ */
  /* Core draw loop                                                     */
  /* ------------------------------------------------------------------ */

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = devicePixelRatioRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Resize canvas if needed
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
    }

    const now = performance.now();

    // FPS calculation --------------------------------------------------
    const fpsData = fpsDataRef.current;
    fpsData.frames += 1;
    if (now - fpsData.last >= 1000) {
      setFps(Math.round((fpsData.frames * 1000) / (now - fpsData.last)));
      fpsData.frames = 0;
      fpsData.last = now;
    }

    // Determine phase progression
    let centreX = 0;
    const centreY = height / 2;

    switch (phaseRef.current) {
      case 'enter': {
        const t = Math.min(1, (now - startedAtRef.current) / 600); // 0.6s enter
        centreX = easeOutCubic(t) * (width / 2);
        if (t >= 1) {
          phaseRef.current = 'pause';
        }
        break;
      }
      case 'pause': {
        centreX = width / 2;
        // If parent has requested exit we transition
        if (shouldExitRef.current) {
          phaseRef.current = 'exit';
          startedAtRef.current = now;
        }
        break;
      }
      case 'exit': {
        const t = Math.min(1, (now - startedAtRef.current) / 500); // 0.5s exit
        centreX = width / 2 + easeInCubic(t) * (width / 2 + 200);
        // record trail positions for motion streaks
        trailRef.current.push({ x: centreX, y: centreY });
        if (trailRef.current.length > 20) trailRef.current.shift();
        if (t >= 1) {
          phaseRef.current = 'idle';
        }
        break;
      }
      case 'idle':
      default:
        break;
    }

    // Clear previous frame with slight alpha for natural fade
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, 0, width, height);

    if (phaseRef.current === 'idle') {
      cancelAnimationFrame(animationId.current!);
      return; // stop drawing once done
    }

    /* -------------------------------------------------------------- */
    /* Draw motion streaks                                            */
    /* -------------------------------------------------------------- */
    if (phaseRef.current === 'exit' && trailRef.current.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,150,100,0.15)';
      ctx.lineWidth = 20;
      ctx.beginPath();
      for (let i = trailRef.current.length - 1; i >= 0; i--) {
        const p = trailRef.current[i];
        const ratio = i / trailRef.current.length;
        ctx.globalAlpha = ratio * 0.6;
        if (i === trailRef.current.length - 1) {
          ctx.moveTo(p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    /* -------------------------------------------------------------- */
    /* Draw blob particles                                            */
    /* -------------------------------------------------------------- */
    const t = now / 1000; // seconds
    const amplitude = 10; // breathing amplitude

    ctx.save();
    ctx.translate(centreX, centreY);

    particlesRef.current.forEach((p: Particle) => {
      const radialBreath = amplitude * Math.sin(t * 2 + p.offsetPhase);
      const r = p.baseRadius + radialBreath;
      const x = r * Math.cos(p.angle);
      const y = r * Math.sin(p.angle);

      const grd = ctx.createRadialGradient(x, y, 0, x, y, 12);
      grd.addColorStop(0, 'hsla(20, 100%, 65%, 1)'); // warm orange
      grd.addColorStop(1, 'hsla(340, 90%, 55%, 0)'); // fade to transparent

      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    // Schedule next frame
    animationId.current = requestAnimationFrame(draw);
  };

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (typeof window === 'undefined') return; // SSR safeguard

    devicePixelRatioRef.current = Math.min(window.devicePixelRatio || 1, 2);

    if (active) {
      shouldExitRef.current = false;
      phaseRef.current = 'enter';
      startedAtRef.current = performance.now();
      initParticles(Math.min(window.innerWidth, window.innerHeight) * 0.25);
      animationId.current = requestAnimationFrame(draw);
    } else {
      // Request graceful exit on next frame if currently running
      if (phaseRef.current === 'pause') {
        shouldExitRef.current = true;
      } else if (phaseRef.current === 'enter') {
        // if still entering, flag exit to trigger when pause would have
        shouldExitRef.current = true;
      }
    }

    return () => {
      if (animationId.current) cancelAnimationFrame(animationId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /* ------------------------------------------------------------------ */

  if (typeof window === 'undefined') return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full z-50 pointer-events-none"
        style={{ opacity: active ? 1 : 0, transition: 'opacity 300ms ease' }}
      />
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'fixed',
            top: 8,
            left: 8,
            fontSize: 12,
            color: '#fff',
            zIndex: 60,
            pointerEvents: 'none',
            fontFamily: 'monospace',
          }}
        >
          {fps} fps
        </div>
      )}
    </>
  );
}