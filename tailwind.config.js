/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Themeable tokens — resolved through CSS variables so the user can
        // switch color themes at runtime (see globals.css [data-theme]).
        // Defined as RGB triplets so Tailwind opacity modifiers (bg-pine/10)
        // keep working.
        paper: {
          DEFAULT: "rgb(var(--fish-paper) / <alpha-value>)",
          deep: "rgb(var(--fish-paper-deep) / <alpha-value>)",
        },
        pine: {
          DEFAULT: "rgb(var(--fish-pine) / <alpha-value>)",
          deep: "rgb(var(--fish-pine-deep) / <alpha-value>)",
        },
        signal: {
          DEFAULT: "rgb(var(--fish-signal) / <alpha-value>)",
          dark: "rgb(var(--fish-signal-dark) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "rgb(var(--fish-gold) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Arial Narrow", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
