/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: '#0a0a0f',
          light: '#12121a',
        },
        surface: {
          DEFAULT: '#1a1a24',
          light: '#242432',
        },
        primary: {
          DEFAULT: '#7c3aed',
          bright: '#a855f7',
          glow: 'rgba(168, 85, 247, 0.4)',
        },
        accent: {
          DEFAULT: '#22d3ee',
          glow: 'rgba(34, 211, 238, 0.3)',
        },
      },
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        mono: ['Share Tech Mono', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scan': 'scan 1.5s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 4px currentColor', opacity: '1' },
          '50%': { boxShadow: '0 0 12px currentColor', opacity: '0.7' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(168, 85, 247, 0.4), inset 0 0 20px rgba(124, 58, 237, 0.05)',
        'glow-accent': '0 0 20px rgba(34, 211, 238, 0.3), inset 0 0 20px rgba(34, 211, 238, 0.05)',
      },
    },
  },
  plugins: [],
};
