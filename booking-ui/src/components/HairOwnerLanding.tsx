import React from "react";

const LINE_CTA_URL = "https://lin.ee/ovVekXY";

export const HairOwnerLanding: React.FC = () => {
  const handleClick = () => window.open(LINE_CTA_URL, "_blank");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 space-y-8">

        {/* HERO */}
        <section className="space-y-3">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
            美容室オーナー向け予約 × 自動リマインド
          </p>
          <h1 className="text-2xl font-bold leading-tight">
            電話対応とDMのラッシュで1日が溶けるサロン運営を卒業しませんか？
          </h1>
          <p className="text-sm text-slate-600">
            Kazuki Booking は{" "}
            <span className="font-semibold">“人力で回している予約運営” を自動化するLINE予約仕組み化パッケージ</span> です。
          </p>
        </section>

        {/* ⚡ 刺さる Before / After */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-rose-100 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-rose-500">Before（導入前）</p>
            <ul className="text-xs text-slate-700 space-y-1.5">
              <li>・電話・DM対応で毎日1〜2時間奪われる</li>
              <li>・予約管理がノート/LIN E /ホットペッパーでバラつく</li>
              <li>・予約抜け・ダブルブッキングが常に怖い</li>
              <li>・新規は来るのに2回目に繋がらない</li>
              <li>・値下げしないと新規が動かない気がする</li>
            </ul>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-600">After（導入後）</p>
            <ul className="text-xs text-slate-800 space-y-1.5">
              <li>・予約はすべてLINEが自動受付 → 施術に集中できる</li>
              <li>・空き枠・キャンセル・リマインドの自動化</li>
              <li>・理想の客層だけが集まる予約導線をLINEに構築</li>
              <li>・来店履歴&メニューから次回提案が簡単</li>
              <li>・オーナー不在でも予約運営が止まらない</li>
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-900 text-slate-50 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-semibold">
            まずは「今の予約導線のどこがボトルネック？」を一緒に棚卸ししませんか？
          </h2>
          <p className="text-sm text-slate-200">
            現状をLINEで送ってもらうだけで、あなたのサロンにとって{" "}
            <span className="font-semibold">一番コスパのいい一手</span> を提案します。
          </p>
          <button
            onClick={handleClick}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-xs font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300 transition"
          >
            LINEで無料トライアル相談をする
          </button>
          <p className="text-[10px] text-slate-400 mt-1">
            ※強引な営業は一切なし／スタンプだけで終了OK
          </p>
        </section>
      </main>

      {/* フッター固定 CTA */}
      <div className="fixed inset-x-0 bottom-0 bg-slate-900 text-slate-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-[11px] leading-tight">
            <div className="font-semibold">＼ 電話対応に追われないサロンへ ／</div>
            <div className="text-slate-300">まずはLINEで無料トライアル相談（1分で完了）</div>
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
