/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0B0F14',
          elevated: '#111827',
        },
        card: '#0F172A',
        border: '#1F2937',
        text: {
          DEFAULT: '#E5E7EB',
          muted: '#94A3B8',
        },
        primary: '#3B82F6',
        danger: '#EF4444',
        success: '#22C55E',
        warning: '#F59E0B',
      },
    },
  },
  plugins: [],
};

