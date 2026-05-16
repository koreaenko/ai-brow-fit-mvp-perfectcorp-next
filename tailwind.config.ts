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
        ink: "#171312",
        cream: "#f8f4ee",
        blush: "#e9c7bd",
        cocoa: "#4a332c",
        sage: "#71816d",
        champagne: "#d7b98f",
      },
      boxShadow: {
        soft: "0 24px 70px rgba(49, 34, 27, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
