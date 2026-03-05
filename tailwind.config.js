/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        stage: {
          bg: "#13120f",
          surface: "#1a1916",
          elevated: "#222018",
          border: "#2a2720",
          gold: "#E8C547",
          text: "#e0ddd5",
          muted: "#8a8070",
          dim: "#555",
        },
        cue: {
          light: "#47B8E8",
          sound: "#E87847",
          props: "#C847E8",
          set: "#7BE847",
          blocking: "#E8C547",
        },
      },
      fontFamily: {
        display: ["Playfair Display", "serif"],
        body: ["Libre Baskerville", "serif"],
        mono: ["DM Mono", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
