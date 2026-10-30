/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Bahnschrift"', '"DIN Alternate"', '"Segoe UI"', 'sans-serif'],
        mono: ['"Bahnschrift"', '"DIN Alternate"', 'sans-serif'],
        serif: ['"Bahnschrift"', '"DIN Alternate"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '12px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      colors: {
        bg: 'var(--bg)',
        bg2: 'var(--bg2)',
        bg3: 'var(--bg3)',
        card: 'var(--card)',
        'card-h': 'var(--card-h)',
        border: 'var(--border)',
        'border-2': 'var(--border-2)',
        'border-3': 'var(--border-3)',
        text: 'var(--text)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        green: {
          DEFAULT: '#4e9463',
          lt: '#6db882',
          dk: '#326644',
          bg: 'var(--green-bg)',
          glow: 'var(--green-glow)',
        },
        orange: {
          DEFAULT: 'var(--orange)',
          lt: 'var(--orange-lt)',
          dk: 'var(--orange-dk)',
          bg: 'var(--orange-bg)',
        },
        purple: {
          DEFAULT: 'var(--purple)',
          lt: 'var(--purple-lt)',
          dk: 'var(--purple-dk)',
          bg: 'var(--purple-bg)',
        },
        accent: {
          DEFAULT: 'var(--orange)',
          lt: 'var(--orange-lt)',
          dk: 'var(--orange-dk)',
          bg: 'var(--orange-bg)',
        },
        'warn-text': 'var(--warn-text)',
        up: 'var(--up)',
        down: 'var(--down)',
        warn: 'var(--warn)',
      },
      animation: {
        'toast-in': 'toastIn 0.25s ease',
        'modal-in': 'modalIn 0.22s ease',
        'marquee': 'marquee 28s linear infinite',
      },
      keyframes: {
        toastIn: {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        modalIn: {
          from: { opacity: '0', transform: 'translateY(-16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
