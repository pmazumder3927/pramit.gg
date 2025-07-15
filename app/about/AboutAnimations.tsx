"use client";

import { useEffect } from "react";

export default function AboutAnimations() {
  useEffect(() => {
    const animatedElements = document.querySelectorAll('[data-animate]');
    
    animatedElements.forEach((element) => {
      const animationType = element.getAttribute('data-animate');
      const delay = parseInt(element.getAttribute('data-delay') || '0', 10);
      
      // Set initial state
      if (animationType === 'fade-up') {
        element.classList.add('opacity-0', 'translate-y-5');
      } else if (animationType === 'fade-in') {
        element.classList.add('opacity-0');
      } else if (animationType === 'slide-right') {
        element.classList.add('opacity-0', '-translate-x-5');
      }
      
      // Apply animation after delay
      setTimeout(() => {
        element.classList.add('transition-all', 'duration-500', 'ease-out');
        
        if (animationType === 'fade-up') {
          element.classList.remove('opacity-0', 'translate-y-5');
        } else if (animationType === 'fade-in') {
          element.classList.remove('opacity-0');
        } else if (animationType === 'slide-right') {
          element.classList.remove('opacity-0', '-translate-x-5');
        }
      }, delay);
    });
  }, []);

  return null;
}