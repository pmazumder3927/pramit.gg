"use client";

import { useEffect } from "react";
import { motion, useAnimation } from "framer-motion";

export default function ClientEnhancements() {
  useEffect(() => {
    // Add animation classes to elements after hydration
    const animateElements = () => {
      // Animate hero title
      const heroTitle = document.querySelector('.hero-title');
      if (heroTitle) {
        heroTitle.classList.add('animate-fade-in');
      }

      // Animate hero subtitle
      const heroSubtitle = document.querySelector('.hero-subtitle');
      if (heroSubtitle) {
        heroSubtitle.classList.add('animate-fade-in-delayed');
      }

      // Animate sections
      const sections = document.querySelectorAll('.featured-section, .posts-section');
      sections.forEach((section, index) => {
        setTimeout(() => {
          section.classList.add('animate-slide-up');
        }, index * 200);
      });

      // Animate post cards
      const postCards = document.querySelectorAll('.post-card');
      postCards.forEach((card, index) => {
        const delay = parseInt(card.getAttribute('data-index') || '0') * 50;
        setTimeout(() => {
          card.classList.add('animate-scale-in');
        }, 800 + delay);
      });

      // Animate about page content
      const aboutContent = document.querySelector('.about-content');
      if (aboutContent) {
        aboutContent.classList.add('animate-fade-in');
      }

      // Animate music page sections
      const musicSections = document.querySelectorAll('.music-section');
      musicSections.forEach((section, index) => {
        setTimeout(() => {
          section.classList.add('animate-fade-in');
        }, index * 100);
      });
    };

    // Run animations after a short delay to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(animateElements, 100);
    });
  }, []);

  return null;
}