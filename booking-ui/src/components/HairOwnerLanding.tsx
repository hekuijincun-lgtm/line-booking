import React from "react";

const LINE_CTA_URL = "https://lin.ee/ovVekXY";

export const HairOwnerLanding: React.FC = () => {
  const handleClick = () => {
    window.open(LINE_CTA_URL, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* ...中略（今のLPのセクション）... */}

      {/* 固定フッターCTA */}
      <div className="fixed inset-x-0 bottom-0 bg-slate-900 text-slate-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-[11px] leading-tight">
            <div className="font-semibold">
              ＼ 電話対応に追われないサロンへ ／
            </div>
            <div className="text-slate-300">
              まずはLINEで無料トライアル相談（1分で完了）
            </div>
          </div>
          <button
            onClick={handleClick}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300 transition"
          >
            LINEで無料トライアル相談をする
          </button>
        </div>
      </div>
    </div>
  );
};
