import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        hanzi: ["var(--font-noto-sc)", "'Noto Sans SC'", "'PingFang SC'", "'Microsoft YaHei'", "sans-serif"]
      }
    }
  },
  plugins: []
};
export default config;
