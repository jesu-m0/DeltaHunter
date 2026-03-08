import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#090b0f",
        surface: "#11141a",
        surface2: "#191d26",
        border: "#252a38",
        txt: "#e0e4ed",
        "txt-dim": "#6a7288",
        user: "#4499ff",
        ref: "#ff6633",
        gain: "#00cc88",
        loss: "#ff3355",
      },
      fontFamily: {
        sans: ["Outfit", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
