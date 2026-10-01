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
        ink: "#242523",
        cream: "#f5f6f4",
        blush: "#ffe8db",
        cocoa: "#454843",
        sage: "#347668",
        champagne: "#e85b21",
      },
      boxShadow: {
        soft: "0 4px 20px rgba(24, 30, 24, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
