/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#0B1020",    // 深めネイビー
          gold: "#FACC15",    // アクセントの金
          bg: "#F3F4F6",      // 全体の淡いグレー背景
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(15,23,42,0.18)",
      },
    },
  },
  plugins: [],
};
