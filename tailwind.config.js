// @ts-check
const { fontFamily } = require('tailwindcss/defaultTheme')
const colors = require('tailwindcss/colors')

/** @type {import("tailwindcss/types").Config } */
module.exports = {
  content: [
    './node_modules/pliny/**/*.js',
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,tsx}',
    './components/**/*.{js,ts,tsx}',
    './layouts/**/*.{js,ts,tsx}',
    './data/**/*.mdx',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      lineHeight: {
        11: '2.75rem',
        12: '3rem',
        13: '3.25rem',
        14: '3.5rem',
      },
      fontFamily: {
        sans: ['var(--font-nunito)', ...fontFamily.sans],
        playpen: ['var(--font-playpen-sans)'],
      },
      colors: {
        primary: colors.rose,
        gray: colors.gray,
        dark: '#1f1f1f',
      },
      zIndex: {
        60: '60',
        70: '70',
        80: '80',
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            a: {
              color: theme('colors.primary.500'),
              '&:hover': {
                color: `${theme('colors.primary.600')}`,
              },
              code: { color: theme('colors.primary.400') },
            },
            'h1,h2': {
              fontWeight: '700',
              letterSpacing: theme('letterSpacing.tight'),
            },
            h3: {
              fontWeight: '600',
            },
            code: {
              color: theme('colors.indigo.500'),
            },
          },
        },
        invert: {
          css: {
            a: {
              color: theme('colors.primary.500'),
              '&:hover': {
                color: `${theme('colors.primary.400')}`,
              },
              code: { color: theme('colors.primary.400') },
            },
            'h1,h2,h3,h4,h5,h6': {
              color: theme('colors.gray.100'),
            },
          },
        },
      }),
      animation: {
        'rubber-band': 'rubber-band 1s ease-in-out',
        jiggle: 'jiggle 0.5s ease-in-out',
      },
      keyframes: {
        'rubber-band': {
          '0%': {
            transform: 'scale(1)',
          },
          '30%': {
            transform: 'scale(1.25)',
          },
          '40%': {
            transform: 'scale(0.75)',
          },
          '50%': {
            transform: 'scale(1.15)',
          },
          '65%': {
            transform: 'scale(0.95)',
          },
          '75%': {
            transform: 'scale(1.05)',
          },
          '100%': {
            transform: 'scale(1)',
          },
        },
        jiggle: {
          '0%': {
            transform: 'rotate(-4deg)',
          },
          '50%': {
            transform: 'rotate(4deg)',
          },
          '100%': {
            transform: 'rotate(-4deg)',
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
}
