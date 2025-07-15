"use client";

import { useEffect } from "react";

export default function PostAnimations() {
  useEffect(() => {
    // Find all elements with animation data attributes
    const animatedElements = document.querySelectorAll('[data-animate]');
    
    animatedElements.forEach((element) => {
      const animationType = element.getAttribute('data-animate');
      const delay = parseInt(element.getAttribute('data-delay') || '0', 10);
      
      // Set initial state
      if (animationType === 'fade-up') {
        element.classList.add('opacity-0', 'translate-y-8');
      } else if (animationType === 'fade-in') {
        element.classList.add('opacity-0');
      }
      
      // Apply animation after delay
      setTimeout(() => {
        element.classList.add('transition-all', 'duration-1000', 'ease-out');
        
        if (animationType === 'fade-up') {
          element.classList.remove('opacity-0', 'translate-y-8');
        } else if (animationType === 'fade-in') {
          element.classList.remove('opacity-0');
        }
      }, delay);
    });

    // Progressive loading for images
    const images = document.querySelectorAll('article img');
    const imageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            img.classList.add('opacity-0', 'scale-95', 'transition-all', 'duration-700');
            
            img.onload = () => {
              img.classList.remove('opacity-0', 'scale-95');
            };
            
            imageObserver.unobserve(img);
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    images.forEach((img) => imageObserver.observe(img));

    return () => {
      imageObserver.disconnect();
    };
  }, []);

  return null;
}