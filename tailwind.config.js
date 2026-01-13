/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Terminal color palette - matching BitChat iOS/Android aesthetic
        background: '#0a0a0a',
        surface: '#1a1a1a',
        primary: '#00ff00',
        secondary: '#ff6600',
        text: '#e0e0e0',
        muted: '#666666',
        error: '#ff4444',
        success: '#00ff00',
        // Simplified terminal colors for quick access
        'terminal-bg': '#0a0a0a',
        'terminal-green': '#00ff00',
        'terminal-yellow': '#ffff00',
        'terminal-red': '#ff4444',
        'terminal-blue': '#00d4ff',
        'terminal-dim': 'rgba(0, 255, 0, 0.4)',
        // Extended palette for UI elements
        terminal: {
          black: '#0a0a0a',
          darkGray: '#1a1a1a',
          gray: '#333333',
          lightGray: '#666666',
          green: '#00ff00',
          orange: '#ff6600',
          red: '#ff4444',
          white: '#e0e0e0',
          // Dimmed versions for hover states
          greenDim: '#00cc00',
          orangeDim: '#cc5500',
        },
      },
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'SF Mono',
          'Monaco',
          'Inconsolata',
          'Roboto Mono',
          'Source Code Pro',
          'monospace',
        ],
      },
      fontSize: {
        // Terminal-optimized font sizes
        'terminal-xs': ['0.75rem', { lineHeight: '1.25rem' }],
        'terminal-sm': ['0.8125rem', { lineHeight: '1.375rem' }],
        'terminal-base': ['0.875rem', { lineHeight: '1.5rem' }],
        'terminal-lg': ['1rem', { lineHeight: '1.75rem' }],
        'terminal-xl': ['1.125rem', { lineHeight: '1.875rem' }],
      },
      spacing: {
        // Terminal-style tight spacing
        'terminal-1': '0.25rem',
        'terminal-2': '0.5rem',
        'terminal-3': '0.75rem',
        'terminal-4': '1rem',
      },
      borderRadius: {
        'terminal': '2px',
        'terminal-sm': '1px',
      },
      boxShadow: {
        'terminal': '0 0 10px rgba(0, 255, 0, 0.1)',
        'terminal-glow': '0 0 20px rgba(0, 255, 0, 0.2)',
        'terminal-error': '0 0 10px rgba(255, 68, 68, 0.1)',
      },
      animation: {
        'cursor-blink': 'cursor-blink 1s step-end infinite',
        'terminal-fade-in': 'terminal-fade-in 0.2s ease-out',
        'terminal-slide-up': 'terminal-slide-up 0.15s ease-out',
      },
      keyframes: {
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'terminal-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'terminal-slide-up': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'terminal-gradient': 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
        'terminal-scanline': 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0, 0, 0, 0.1) 1px, rgba(0, 0, 0, 0.1) 2px)',
      },
    },
  },
  plugins: [],
};
