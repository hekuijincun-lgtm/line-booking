import React from "react";

export const HairOwnerLanding: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* HERO */}
      <header className="max-w-3xl mx-auto px-4 pt-10 pb-8">
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold mb-4">
          美容室オーナー向け予約ツール
        </div>
        <h1 className="text-2xl md:text-3xl font-bold leading-relaxed mb-3">
          予約管理のストレスを、
          <span className="inline-block bg-yellow-200 px-1 rounded-sm">
            仕組みごとゼロへ。
          </span>
        </h1>
        <p className="text-sm md:text-base text-slate-600 leading-relaxed">
          もう「電話対応」「ダブルブッキング」「空き枠の反映漏れ」に悩まない美容室へ。
          予約作業はツールに任せて、オーナーとスタッフが施術に集中できる毎日へ。
        </p>
      </header>

      <main className="max-w-3xl mx-auto px-4 space-y-10">
        {/* BEFORE / AFTER */}
        <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-semibold mb-4">導入前と導入後の違い</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-500 mb-2">導入前</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>・予約の電話対応で施術が中断される</li>
                <li>・紙やノート管理で記入ミスが不安</li>
                <li>・空き枠の管理がめんどうで反映漏れが出る</li>
                <li>・SNSからの予約導線が弱く、機会損失が多い</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-600 mb-2">導入後</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>・LINEで24時間自動受付、施術に集中できる</li>
                <li>・予約枠は一括登録 ＆ 自動管理でミスを削減</li>
                <li>・空き枠はカレンダーと連動して自動反映</li>
                <li>・InstagramやLINEからそのまま予約に繋がる</li>
              </ul>
            </div>
          </div>
        </section>

        {/* WHO セクション */}
        <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-semibold mb-3">こんなオーナー様に選ばれています</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>・毎日1〜2時間、予約対応と管理に取られている</li>
            <li>・「誰がいつ来たか」を追える仕組みがなく、リピート率を上げづらい</li>
            <li>・将来的に2店舗目・3店舗目も見据えて、今のうちに仕組み化しておきたい</li>
          </ul>
          <p className="mt-4 text-sm text-slate-600">
            1つでも当てはまるなら、
            <span className="font-semibold">
              「人の根性ではなく、仕組み」で予約管理を回すタイミング
            </span>
            かもしれません。
          </p>
        </section>

        {/* PLAN セクション */}
        <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-semibold mb-3">料金プラン（例）</h2>
          <p className="text-xs text-slate-500 mb-4">
            ※サロンの規模に合わせて柔軟に変更可能です
          </p>

          <div className="space-y-4">
            <div className="border border-slate-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-slate-500 mb-1">ライトプラン</p>
              <p className="text-base font-bold mb-1">月額 5,000円〜</p>
              <p className="text-xs text-slate-500 mb-2">LINE予約 + カレンダー連携</p>
              <ul className="text-xs text-slate-700 space-y-1">
                <li>・LINEからの自動予約受付</li>
                <li>・基本的な予約枠管理</li>
                <li>・スマホ対応の予約画面</li>
              </ul>
            </div>

            <div className="border border-amber-300 bg-amber-50 rounded-2xl p-4 relative">
              <span className="absolute -top-3 right-4 text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white">
                おすすめ
              </span>
              <p className="text-xs font-semibold text-amber-700 mb-1">スタンダードプラン</p>
              <p className="text-base font-bold mb-1">月額 8,000円〜</p>
              <p className="text-xs text-slate-500 mb-2">予約管理 + リピート導線の強化</p>
              <ul className="text-xs text-slate-700 space-y-1">
                <li>・リピート導線を意識した予約導線</li>
                <li>・人気メニューや時間帯の傾向分析</li>
                <li>・キャンセル／空き枠の自動リマインド</li>
              </ul>
            </div>
          </div>
        </section>

        {/* FINAL セクション */}
        <section className="bg-slate-900 text-slate-50 rounded-2xl p-6 md:p-7 space-y-3">
          <h2 className="text-lg font-semibold">
            電話対応に追われないサロン運営へ、最初の一歩を。
          </h2>
          <p className="text-sm text-slate-200">
            まずはオーナー様の現状ヒアリングから。
            あなたのサロンに合った導入パターンと料金イメージを、
            LINEでカジュアルにご提案します。
          </p>
          <p className="text-xs text-slate-400">
            ※強引な営業は一切しません。<br />
            「今じゃない」と感じた場合は、その場でお断りいただいて大丈夫です。
          </p>
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
            className="px-4 py-2 rounded-full text-xs font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300 transition"
          >
            LINEで無料トライアル相談をする
          </button>
        </div>
      </div>
    </div>
  );
};
