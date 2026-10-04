/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Exact tokens from the original Stillwater Tackle Co. theme.css
        paper: {
          DEFAULT: "#fdfdfb",
          deep: "#f2efe7",
        },
        pine: {
          DEFAULT: "#12322b",
          deep: "#0b231f",
        },
        signal: {
          DEFAULT: "#e4572e",
          dark: "#c94826",
        },
        gold: {
          DEFAULT: "#b97e14",
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
