"use client";

import React, { useEffect, useRef } from 'react';
import { useLoading } from '../lib/loadingContext';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  saturation: number;
  lightness: number;
  alpha: number;
  phase: number;
  amplitude: number;
  frequency: number;
}

export default function BlobLoader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef(0);
  const { isLoading, direction } = useLoading();
  const loadingStateRef = useRef<'entering' | 'breathing' | 'exiting' | 'idle'>('idle');
  const blobCenterRef = useRef({ x: -200, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Set canvas size
    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Initialize particles with more organic distribution
    const particleCount = 150;
    particlesRef.current = Array.from({ length: particleCount }, (_, i) => {
      // Use golden angle for better distribution
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const angle = i * goldenAngle;
      
      // Vary radius using fibonacci spiral for natural clustering
      const radiusFactor = Math.sqrt(i / particleCount);
      const radius = 30 + radiusFactor * 50 + (Math.random() - 0.5) * 20;
      
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        size: 1.5 + Math.pow(Math.random(), 2) * 4.5, // Favor smaller particles
        hue: 15 + Math.random() * 30, // Warm orange-red spectrum
        saturation: 60 + Math.random() * 40,
        lightness: 45 + Math.random() * 25,
        alpha: 0.2 + Math.pow(Math.random(), 2) * 0.6,
        phase: Math.random() * Math.PI * 2,
        amplitude: 8 + Math.random() * 25,
        frequency: 0.3 + Math.random() * 1.2,
      };
    });

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      timeRef.current += 0.008; // Slightly slower for smoother motion

      // Update loading state
      if (isLoading) {
        if (loadingStateRef.current === 'idle') {
          loadingStateRef.current = 'entering';
          blobCenterRef.current.x = direction === 'left' ? canvas.width + 200 : -200;
          blobCenterRef.current.y = canvas.height / 2;
        }
      } else if (loadingStateRef.current === 'breathing') {
        loadingStateRef.current = 'exiting';
      }

      // Update blob center position based on state
      const targetXMap: Record<typeof loadingStateRef.current, number> = {
        entering: canvas.width / 2,
        breathing: canvas.width / 2,
        exiting: direction === 'right' ? canvas.width + 200 : -200,
        idle: direction === 'right' ? -200 : canvas.width + 200,
      };
      const targetX = targetXMap[loadingStateRef.current];

      // Smooth easing function
      const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      
      const speed = loadingStateRef.current === 'exiting' ? 0.06 : 0.035;
      const diff = targetX - blobCenterRef.current.x;
      const progress = Math.min(Math.abs(diff) / (canvas.width + 400), 1);
      const easedSpeed = speed * (1 + easeInOutCubic(1 - progress) * 2);
      
      blobCenterRef.current.x += diff * easedSpeed;
      blobCenterRef.current.y = canvas.height / 2;

      // Check state transitions
      if (loadingStateRef.current === 'entering' && 
          Math.abs(blobCenterRef.current.x - canvas.width / 2) < 2) {
        loadingStateRef.current = 'breathing';
      } else if (loadingStateRef.current === 'exiting' && 
                 (direction === 'right' ? blobCenterRef.current.x > canvas.width + 150 : blobCenterRef.current.x < -150)) {
        loadingStateRef.current = 'idle';
      }

      // Only render if not idle
      if (loadingStateRef.current !== 'idle') {
        // Multi-layer glow effect
        const glowLayers = [
          { radius: 200, alpha: 0.08 },
          { radius: 120, alpha: 0.12 },
          { radius: 60, alpha: 0.18 }
        ];
        
        ctx.globalCompositeOperation = 'screen';
        glowLayers.forEach(layer => {
          const gradient = ctx.createRadialGradient(
            blobCenterRef.current.x, blobCenterRef.current.y, 0,
            blobCenterRef.current.x, blobCenterRef.current.y, layer.radius
          );
          gradient.addColorStop(0, `hsla(25, 100%, 55%, ${layer.alpha})`);
          gradient.addColorStop(0.5, `hsla(20, 100%, 50%, ${layer.alpha * 0.5})`);
          gradient.addColorStop(1, 'transparent');
          
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        });

        // Update and draw particles
        ctx.globalCompositeOperation = 'lighter';
        
        particlesRef.current.forEach((particle, i) => {
          // Complex breathing pattern with multiple harmonics
          const breathingScale = loadingStateRef.current === 'breathing' 
            ? 1 + Math.sin(timeRef.current * 1.8 + particle.phase) * 0.15 +
                  Math.sin(timeRef.current * 3.6 + particle.phase * 2) * 0.08
            : 1;
          
          // Perlin-noise-inspired movement (simplified)
          const noiseX = Math.sin(timeRef.current * particle.frequency + particle.phase) * 
                        Math.cos(timeRef.current * particle.frequency * 0.7);
          const noiseY = Math.cos(timeRef.current * particle.frequency + particle.phase) * 
                        Math.sin(timeRef.current * particle.frequency * 0.7);
          
          // Flocking behavior
          const neighborCount = 5;
          let cohesionX = 0, cohesionY = 0;
          let separationX = 0, separationY = 0;
          let alignmentX = 0, alignmentY = 0;
          let neighbors = 0;
          
          // Simple flocking (performance optimized)
          for (let j = Math.max(0, i - neighborCount); j < Math.min(particlesRef.current.length, i + neighborCount); j++) {
            if (i === j) continue;
            const other = particlesRef.current[j];
            const dx = other.x - particle.x;
            const dy = other.y - particle.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 60) {
              neighbors++;
              cohesionX += other.x;
              cohesionY += other.y;
              
              if (dist < 20) {
                separationX -= dx / dist;
                separationY -= dy / dist;
              }
              
              alignmentX += other.vx;
              alignmentY += other.vy;
            }
          }
          
          if (neighbors > 0) {
            cohesionX = (cohesionX / neighbors - particle.x) * 0.02;
            cohesionY = (cohesionY / neighbors - particle.y) * 0.02;
            alignmentX = alignmentX / neighbors * 0.05;
            alignmentY = alignmentY / neighbors * 0.05;
          }
          
          // Target position with organic movement
          const angleOffset = timeRef.current * particle.frequency + particle.phase;
          const targetX = (Math.cos(angleOffset) * (40 + particle.amplitude) + 
                          noiseX * 15 + cohesionX + separationX * 10 + alignmentX) * breathingScale;
          const targetY = (Math.sin(angleOffset) * (40 + particle.amplitude) + 
                          noiseY * 15 + cohesionY + separationY * 10 + alignmentY) * breathingScale;
          
          // Smooth interpolation with momentum
          const lerpFactor = 0.08;
          particle.vx = particle.vx * 0.95 + (targetX - particle.x) * lerpFactor;
          particle.vy = particle.vy * 0.95 + (targetY - particle.y) * lerpFactor;
          particle.x += particle.vx;
          particle.y += particle.vy;

          // Motion blur effect during transitions
          const motionBlur = loadingStateRef.current === 'exiting' || loadingStateRef.current === 'entering' ? 4 : 1;
          const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
          
          // Draw particle with trails
          for (let j = 0; j < motionBlur; j++) {
            const trailFactor = j / motionBlur;
            const offsetX = particle.vx * trailFactor * 3;
            const offsetY = particle.vy * trailFactor * 3;
            const alpha = particle.alpha * (1 - trailFactor * 0.7) * 
                         (loadingStateRef.current === 'breathing' ? 1 : 0.7);
            
            // Particle glow
            const particleX = blobCenterRef.current.x + particle.x - offsetX;
            const particleY = blobCenterRef.current.y + particle.y - offsetY;
            
            // Outer glow
            const glowGradient = ctx.createRadialGradient(
              particleX, particleY, 0,
              particleX, particleY, particle.size * 4
            );
            glowGradient.addColorStop(0, `hsla(${particle.hue}, ${particle.saturation}%, ${particle.lightness + 10}%, ${alpha * 0.5})`);
            glowGradient.addColorStop(1, 'transparent');
            
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(particleX, particleY, particle.size * 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Core particle
            const particleGradient = ctx.createRadialGradient(
              particleX, particleY, 0,
              particleX, particleY, particle.size
            );
            particleGradient.addColorStop(0, `hsla(${particle.hue}, ${particle.saturation}%, ${particle.lightness + 20}%, ${alpha})`);
            particleGradient.addColorStop(0.5, `hsla(${particle.hue}, ${particle.saturation}%, ${particle.lightness}%, ${alpha * 0.8})`);
            particleGradient.addColorStop(1, `hsla(${particle.hue}, ${particle.saturation}%, ${particle.lightness - 10}%, 0)`);
            
            ctx.fillStyle = particleGradient;
            ctx.beginPath();
            ctx.arc(particleX, particleY, particle.size, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // Draw subtle connections between nearby particles
        if (loadingStateRef.current === 'breathing') {
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineCap = 'round';
          
          for (let i = 0; i < particlesRef.current.length; i++) {
            const p1 = particlesRef.current[i];
            for (let j = i + 1; j < Math.min(i + 10, particlesRef.current.length); j++) {
              const p2 = particlesRef.current[j];
              const dist = Math.sqrt(
                Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)
              );
              
              if (dist < 40) {
                const alpha = Math.pow(1 - dist / 40, 2) * 0.15;
                
                // Create gradient line
                const lineGradient = ctx.createLinearGradient(
                  blobCenterRef.current.x + p1.x,
                  blobCenterRef.current.y + p1.y,
                  blobCenterRef.current.x + p2.x,
                  blobCenterRef.current.y + p2.y
                );
                lineGradient.addColorStop(0, `hsla(${p1.hue}, 80%, 60%, ${alpha})`);
                lineGradient.addColorStop(1, `hsla(${p2.hue}, 80%, 60%, ${alpha})`);
                
                ctx.strokeStyle = lineGradient;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(
                  blobCenterRef.current.x + p1.x,
                  blobCenterRef.current.y + p1.y
                );
                ctx.lineTo(
                  blobCenterRef.current.x + p2.x,
                  blobCenterRef.current.y + p2.y
                );
                ctx.stroke();
              }
            }
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [isLoading, direction]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[100]"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}