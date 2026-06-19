import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        panel: "0 18px 60px rgba(15, 23, 42, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
