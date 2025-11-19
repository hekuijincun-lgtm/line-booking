/** Kazuki Booking Tailwind Theme */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans JP"', "system-ui", "sans-serif"],
      },
      colors: {
        kb: {
          bg: "#f3f4f6",        // ページ背景（うっすらグレー）
          surface: "#ffffff",   // カード / フォーム背景
          navy: "#0f172a",      // メイン濃紺
          navySoft: "#111827",  // ヘッダーなど
          gold: "#fbbf24",      // アクセントの金
          goldSoft: "#facc15",  // ホバー用
          border: "#e5e7eb",    // 枠線
          textMain: "#111827",  // メイン文字
          textMuted: "#6b7280", // サブ文字
          accent: "#38bdf8",    // 補助アクセント
          danger: "#ef4444",    // エラー / キャンセル用
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        "kb-soft": "0 18px 45px rgba(15,23,42,0.12)",
        "kb-subtle": "0 10px 30px rgba(15,23,42,0.08)",
      },
    },
  },
  plugins: [],
};
