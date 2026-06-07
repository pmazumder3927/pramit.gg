import type { Config } from 'tailwindcss'

// Helper: a theme-aware color backed by an RGB-triplet CSS variable.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ---- Sketchbook semantic tokens (theme-aware via CSS vars) ----
        paper: v('--bg'),
        'paper-2': v('--surface-2'),
        card: v('--surface'),
        ink: v('--fg'),
        'ink-soft': v('--fg-soft'),
        'ink-faint': v('--fg-faint'),
        line: v('--line'),

        // ---- Legacy dark-palette names remapped to semantic surfaces ----
        // (so existing components using these flip between light/dark for free)
        'void-black': v('--bg'),
        'charcoal-black': v('--surface'),
        'deep-graphite': v('--surface-2'),
        'slate-gray': v('--surface-2'),

        // ---- Accents (theme-tuned: legible burnt on paper, glowing on dark) ----
        'accent-orange': v('--accent-orange'),
        'accent-purple': v('--accent-purple'),
        'accent-rust': v('--accent-rust'),
        'cyber-orange': v('--accent-orange'),
        'neon-purple': v('--accent-purple'),
        // these stay static (used in music sequencer chips etc.)
        'accent-blue': '#4a9eff',
        'accent-green': '#30d158',
        'accent-pink': '#ff375f',
        'accent-yellow': '#ffd60a',

        // ---- Override `white` to mean "foreground" so text-white / white/x
        //      / border-white flip across the whole site. Escape hatch below. ----
        white: v('--fg'),
        'pure-white': '#ffffff',
        'true-black': '#000000',

        // ---- Warm, theme-aware gray ramp (replaces the cold default ramp) ----
        gray: {
          50: v('--gray-50'),
          100: v('--gray-100'),
          200: v('--gray-200'),
          300: v('--gray-300'),
          400: v('--gray-400'),
          500: v('--gray-500'),
          600: v('--gray-600'),
          700: v('--gray-700'),
          800: v('--gray-800'),
          900: v('--gray-900'),
          950: v('--gray-950'),
        },
      },
      fontFamily: {
        sans: ['var(--font-work)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-fraunces)', 'Georgia', 'Cambria', 'serif'],
        hand: ['var(--font-caveat)', 'ui-rounded', 'cursive'],
        mono: ['SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'fade-in-up': 'fadeInUp 0.8s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'slide-left': 'slideLeft 0.4s ease-out',
        'slide-right': 'slideRight 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'scale-out': 'scaleOut 0.3s ease-out',
        'pulse-soft': 'pulseSoft 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-subtle': 'pulseSubtle 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glitch': 'glitch 0.6s ease-in-out',
        'glitch-subtle': 'glitchSubtle 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 3s infinite',
        'spin-slow': 'spin 3s linear infinite',
        'spin-reverse': 'spinReverse 3s linear infinite',
        'bounce-subtle': 'bounceSubtle 2s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'draw-in': 'drawIn 1s ease forwards',
        'eq': 'eq 1.1s ease-in-out infinite',
        'bob': 'bob 3.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(15px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-15px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideLeft: {
          '0%': { transform: 'translateX(15px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(-15px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.9)', opacity: '0' },
        },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
        pulseSubtle: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.8' } },
        glitch: {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 1px)' },
          '40%': { transform: 'translate(-1px, -1px)' },
          '60%': { transform: 'translate(2px, 1px)' },
          '80%': { transform: 'translate(1px, -1px)' },
          '100%': { transform: 'translate(0)' },
        },
        glitchSubtle: {
          '0%, 90%': { transform: 'translate(0)' },
          '92%': { transform: 'translate(-1px, 1px)' },
          '94%': { transform: 'translate(1px, -1px)' },
          '96%': { transform: 'translate(-1px, -1px)' },
          '98%': { transform: 'translate(1px, 1px)' },
          '100%': { transform: 'translate(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        spinReverse: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(-360deg)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        drawIn: { to: { strokeDashoffset: '0' } },
        eq: { '0%, 100%': { transform: 'scaleY(0.4)' }, '50%': { transform: 'scaleY(1)' } },
        bob: {
          '0%, 100%': { transform: 'translateY(0) rotate(8deg)' },
          '50%': { transform: 'translateY(-5px) rotate(2deg)' },
        },
      },
      backdropBlur: {
        xs: '2px',
        '3xl': '64px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-subtle': 'linear-gradient(135deg, rgb(var(--fg) / 0.06) 0%, rgb(var(--fg) / 0.02) 100%)',
        'gradient-dark': 'linear-gradient(135deg, rgb(var(--bg) / 0.85) 0%, rgb(var(--bg) / 0.4) 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgb(var(--fg) / 0.12)',
        'glass-dark': '0 18px 50px -20px rgb(var(--fg) / 0.35)',
        'glow': '0 0 24px rgb(var(--accent-orange) / 0.32)',
        'glow-purple': '0 0 24px rgb(var(--accent-purple) / 0.32)',
        'glow-subtle': '0 0 10px rgb(var(--fg) / 0.08)',
        'paper': '2px 5px 16px -6px rgb(var(--fg) / 0.30)',
        'paper-lg': '6px 12px 30px -10px rgb(var(--fg) / 0.32)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      letterSpacing: {
        'wider': '0.1em',
        'widest': '0.2em',
      },
      lineHeight: {
        '12': '3rem',
        '14': '3.5rem',
      },
    },
  },
  plugins: [],
}
export default config
