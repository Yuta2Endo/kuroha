/**
 * Kuroha — Tailwind theme extension
 * Version 3.0 · November 2026
 *
 * Torii, ensō and sakura. Ink, paper and one red accent.
 *
 * Usage:
 *   const kuroha = require("./brand/tailwind-tokens.js");
 *   module.exports = {
 *     content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
 *     theme: { extend: kuroha.theme.extend },
 *   };
 */

module.exports = {
  theme: {
    extend: {
      colors: {
        ink: {
          950: "var(--kh-ink-950)",
          900: "var(--kh-ink-900)",
          800: "var(--kh-ink-800)",
          700: "var(--kh-ink-700)",
        },
        paper: {
          DEFAULT: "var(--kh-paper)",
          2: "var(--kh-paper-2)",
        },
        red: {
          DEFAULT: "var(--kh-red)",
          light: "var(--kh-red-light)",
          dark: "var(--kh-red-dark)",
        },
        gray: {
          500: "var(--kh-gray-500)",
          300: "var(--kh-gray-300)",
          200: "var(--kh-gray-200)",
        },
        moss: "var(--kh-moss)",

        /* Legacy 2.0 aliases. Prefer ink/paper/red in new work. */
        brass: {
          DEFAULT: "var(--kh-red)",
          light: "var(--kh-red-light)",
          dark: "var(--kh-red-dark)",
        },
        moon: {
          DEFAULT: "var(--kh-red-light)",
          dark: "var(--kh-red-dark)",
        },
        oxblood: {
          DEFAULT: "var(--kh-red-dark)",
          soft: "var(--kh-red)",
        },
        graphite: "var(--kh-gray-500)",
        muted: "var(--kh-gray-300)",

        kh: {
          bg: "var(--kh-bg)",
          bgDeep: "var(--kh-bg-deep)",
          surface: "var(--kh-surface)",
          surfaceRaised: "var(--kh-surface-raised)",
          text: "var(--kh-text)",
          textMuted: "var(--kh-text-muted)",
          textFaint: "var(--kh-text-faint)",
          accent: "var(--kh-accent)",
          accentSoft: "var(--kh-accent-soft)",
          link: "var(--kh-link)",
          border: "var(--kh-border)",
          borderStrong: "var(--kh-border-strong)",
          borderAccent: "var(--kh-border-accent)",
        },
      },
      fontFamily: {
        display: ["var(--kh-font-display)"],
        ui: ["var(--kh-font-ui)"],
        reading: ["var(--kh-font-reading)"],
        sans: ["var(--kh-font-ui)"],
      },
      fontSize: {
        xs: ["var(--kh-text-xs)", { lineHeight: "1.4" }],
        sm: ["var(--kh-text-sm)", { lineHeight: "1.5" }],
        base: ["var(--kh-text-base)", { lineHeight: "1.6" }],
        md: ["var(--kh-text-md)", { lineHeight: "1.6" }],
        lg: ["var(--kh-text-lg)", { lineHeight: "1.4" }],
        xl: ["var(--kh-text-xl)", { lineHeight: "1.2" }],
        "2xl": ["var(--kh-text-2xl)", { lineHeight: "1.15" }],
        "3xl": ["var(--kh-text-3xl)", { lineHeight: "1.05" }],
        "4xl": ["var(--kh-text-4xl)", { lineHeight: "1" }],
        "5xl": ["var(--kh-text-5xl)", { lineHeight: "0.95" }],
      },
      spacing: {
        1: "var(--kh-space-1)",
        2: "var(--kh-space-2)",
        3: "var(--kh-space-3)",
        4: "var(--kh-space-4)",
        5: "var(--kh-space-5)",
        6: "var(--kh-space-6)",
        7: "var(--kh-space-7)",
        8: "var(--kh-space-8)",
        9: "var(--kh-space-9)",
      },
      borderRadius: {
        paper: "var(--kh-radius-paper)",
        cover: "var(--kh-radius-cover)",
        button: "var(--kh-radius-button)",
        input: "var(--kh-radius-input)",
        card: "var(--kh-radius-card)",
        large: "var(--kh-radius-large)",
        pill: "var(--kh-radius-pill)",
      },
      boxShadow: {
        paper: "var(--kh-shadow-paper)",
        card: "var(--kh-shadow-card)",
        glow: "var(--kh-shadow-glow)",
      },
      transitionTimingFunction: {
        "kh-out": "var(--kh-ease-out)",
        "kh-in-out": "var(--kh-ease-in-out)",
      },
      transitionDuration: {
        fast: "var(--kh-duration-fast)",
        DEFAULT: "var(--kh-duration)",
        slow: "var(--kh-duration-slow)",
      },
      maxWidth: {
        reading: "65ch",
        content: "var(--kh-container)",
      },
      backgroundImage: {
        "kh-night": "var(--kh-gradient-night)",
        "kh-paper": "var(--kh-gradient-paper)",
        "kh-red": "var(--kh-gradient-red)",
        "kh-brass": "var(--kh-gradient-red)",
      },
    },
  },
};
