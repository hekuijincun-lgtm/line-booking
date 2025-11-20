import React from "react";

const LINE_CTA_URL = "https://lin.ee/ovVekXY";

export const HairOwnerLanding: React.FC = () => {
  const handleClick = () => {
    window.open(LINE_CTA_URL, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 space-y-8">
        {/* HERO */}
        <section className="space-y-3">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
            <span>美容室オーナー向け</span>
            <span className="text-[10px] text-amber-500">LINE予約 × 自動リマインド</span>
          </p>
          <h1 className="text-2xl font-bold leading-tight">
            電話対応とDMのラッシュで、
            <br className="hidden md:block" />
            1日が終わるサロン運営を卒業しませんか？
          </h1>
          <p className="text-sm text-slate-600">
            「予約だけで1〜2時間溶けてる」「予約ミスが怖くて、結局オーナーが全部見る」。
            Kazuki Booking は、そうした{" "}
            <span className="font-semibold">
              “人力で回している予約運営” を自動化するためのLINE予約仕組み化パッケージ
            </span>
            です。
          </p>
        </section>

        {/* BEFORE / AFTER セクション（刺さる系） */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-rose-100 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-rose-500 uppercase tracking-wide">Before</p>
            <h2 className="text-sm font-bold text-rose-700 mb-1">
              導入前によくある「しんどい状態」
            </h2>
            <ul className="text-xs text-slate-700 space-y-1.5">
              <li>・電話・DM対応で毎日1〜2時間奪われる</li>
              <li>・ノート／LINE／ホットペッパーなど管理がバラバラ</li>
              <li>・予約抜け・ダブルブッキングが常に怖い</li>
              <li>・新規は来るのに「2回目以降」がなかなか続かない</li>
              <li>・値下げしないと新規が動かない気がしている</li>
            </ul>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">After</p>
            <h2 className="text-sm font-bold text-emerald-800 mb-1">
              導入後に目指す「オーナーが自由な状態」
            </h2>
            <ul className="text-xs text-slate-800 space-y-1.5">
              <li>・予約はすべてLINEが自動受付 → スタッフは施術に集中</li>
              <li>・空き枠・キャンセル・リマインドが自動で流れる</li>
              <li>・理想の客層だけが集まる導線をLINE上に設計</li>
              <li>・来店履歴＆メニューから“次回来店”の声かけがしやすく</li>
              <li>・「オーナーが現場にいなくても予約運営が止まらない」状態へ</li>
            </ul>
          </div>
        </section>

        {/* CALL TO ACTION セクション */}
        <section className="bg-slate-900 text-slate-50 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-semibold">
            まずは「今の予約導線、何がボトルネックか？」を一緒に棚卸ししませんか？
          </h2>
          <p className="text-sm text-slate-200">
            いきなりフル導入ではなく、
            <span className="font-semibold">「最小限の自動化」から一緒に設計</span>
            します。
            LINEで現状を送ってもらえれば、
            あなたのサロンにとって{" "}
            <span className="font-semibold">一番コスパのいい一手</span> だけを提案します。
          </p>
          <p className="text-xs text-slate-400">
            ※強引な営業は一切しません。
            「今じゃない」と感じたらその場でスタンプ1個で終わりです。
          </p>
          <button
            onClick={handleClick}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-xs font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300 transition"
          >
            LINEで無料トライアル相談をする
          </button>
        </section>
      </main>

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
