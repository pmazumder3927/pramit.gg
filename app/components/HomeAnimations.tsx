"use client";

import { useEffect } from "react";
import { motion, useAnimation, AnimationControls } from "framer-motion";

export default function HomeAnimations() {
  useEffect(() => {
    // Find all elements with animation data attributes
    const animatedElements = document.querySelectorAll('[data-animate]');
    
    animatedElements.forEach((element) => {
      const animationType = element.getAttribute('data-animate');
      const delay = parseInt(element.getAttribute('data-delay') || '0', 10);
      const staggerDelay = parseInt(element.getAttribute('data-stagger-delay') || '0', 10);
      
      // Set initial state
      if (animationType === 'fade-up') {
        element.classList.add('opacity-0', 'translate-y-5');
      } else if (animationType === 'fade-in') {
        element.classList.add('opacity-0');
      } else if (animationType === 'slide-right') {
        element.classList.add('opacity-0', '-translate-x-5');
      } else if (animationType === 'scale-x') {
        element.classList.add('scale-x-0', 'origin-left');
      } else if (animationType === 'fade-scale') {
        element.classList.add('opacity-0', 'scale-95');
      }
      
      // Apply animation after delay
      setTimeout(() => {
        element.classList.add('transition-all', 'duration-700', 'ease-out');
        
        if (animationType === 'fade-up') {
          element.classList.remove('opacity-0', 'translate-y-5');
        } else if (animationType === 'fade-in') {
          element.classList.remove('opacity-0');
        } else if (animationType === 'slide-right') {
          element.classList.remove('opacity-0', '-translate-x-5');
        } else if (animationType === 'scale-x') {
          element.classList.remove('scale-x-0');
        } else if (animationType === 'fade-scale') {
          element.classList.remove('opacity-0', 'scale-95');
        }
      }, delay + staggerDelay);
    });

    // Handle stagger animations for children
    const staggerContainers = document.querySelectorAll('[data-animate-children="stagger"]');
    staggerContainers.forEach((container) => {
      const children = container.querySelectorAll('[data-animate]');
      const baseDelay = parseInt(container.getAttribute('data-delay') || '0', 10);
      
      children.forEach((child, index) => {
        const childDelay = parseInt(child.getAttribute('data-stagger-delay') || `${index * 50}`, 10);
        child.setAttribute('data-delay', `${baseDelay + childDelay}`);
      });
    });

    // Add intersection observer for elements below the fold
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target;
            const animationType = element.getAttribute('data-animate');
            
            if (animationType) {
              element.classList.add('transition-all', 'duration-700', 'ease-out');
              
              if (animationType === 'fade-up') {
                element.classList.remove('opacity-0', 'translate-y-5');
              } else if (animationType === 'fade-in') {
                element.classList.remove('opacity-0');
              }
              
              observer.unobserve(element);
            }
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    // Observe elements that might be below the fold
    const delayedElements = document.querySelectorAll('[data-animate][data-delay="1400"], [data-animate-children]');
    delayedElements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, []);

  // This component doesn't render anything - it just adds animations to existing DOM
  return null;
}