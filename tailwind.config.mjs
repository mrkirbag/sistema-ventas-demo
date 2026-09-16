/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        primary: '#0F0529',
        secondary: '#1F0A52',
        accent: '#A855F7',
        'custom-gray': '#F1F5F9',
        tertiary: '#6366F1',
        'background-dark': '#0F0529',
        'card-dark': '#1F0A52',
        'text-muted': '#94A3B8',
      },
      fontFamily: {
        display: ['Roboto', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      keyframes: {
        slideDown: {
          from: {
            opacity: '0',
            transform: 'translateY(-10px)',
            clipPath: 'inset(0 0 100% 0)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
            clipPath: 'inset(0 0 0 0)',
          },
        },
      },
      animation: {
        'slide-down': 'slideDown 0.4s ease-out forwards',
      },
    },
  },
};
