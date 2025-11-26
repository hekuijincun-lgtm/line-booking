import { BeforeAfterSection } from "../components/sections/BeforeAfterSection";
/**
 * Kazuki Booking - まつげサロン向け LP
 * - スマホ最適化
 * - Hero + Pricing + BEFORE/AFTER + 下固定CTA
 */

function HeroSection() {
  return (
    <section className="space-y-6">
      {/* ラベル */}
      <div className="inline-flex items-center rounded-full bg-slate-50/80 px-3 py-1 text-xs font-semibold text-rose-500">
        <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
        まつげサロン向け&nbsp;|&nbsp;LINE予約SaaS
      </div>

      {/* タイトル */}
      <div className="space-y-3">
        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          <span className="block text-rose-500">Kazuki Booking</span>
          <span className="block">
            「LINEだけ」で
            <span className="text-amber-200">
              &nbsp;予約・リマインド・リピート
            </span>
            まで自動化。
          </span>
        </h1>
        <p className="text-sm leading-relaxed text-slate-800">
          マツエク・ラッシュリフトの予約LINEに追われる毎日から卒業。
          ダブルブッキングと返信漏れをゼロにして、<br />
          あなたはデザイン提案とリピートづくりに集中できます。
          初期費用0円、1席から導入OK。
        </p>
      </div>

      {/* Hero画像（ラッシュ用キャプチャに差し替えOK） */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
        <div className="relative aspect-[4/5] w-full">
          <img
            src="/images/booking-hero-preview.png"
            alt="Kazuki Booking の予約画面イメージ"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-700">
          * 実際の管理画面・予約画面イメージです（サロンごとにカスタム可能）
        </div>
      </div>

      {/* 1st CTA */}
      <div className="space-y-2">
        <a
          href="https://lin.ee/your-line-url"
          target="_blank"
          rel="noreferrer"
          className="flex h-12 items-center justify-center rounded-xl bg-emerald-400 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-300 active:scale-[0.99] transition"
        >
          💚 LINEで無料相談・デモ予約
        </a>
        <p className="text-[11px] leading-relaxed text-slate-700">
          ※ 24時間いつでもメッセージOK / 無理な営業は一切しません。
        </p>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section className="mt-10 space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-amber-200">導入プラン</h2>
        <p className="text-xs text-slate-800">
          1席の個人サロンから、小さめのまつげサロンまでフィットする料金設計。
          まずはテスト導入からでもOKです。
        </p>
      </div>

      {/* プランカード */}
      <div className="space-y-4">
        {/* スタンダード */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Standard
              </p>
              <p className="text-sm font-semibold text-slate-900">
                1席〜少人数サロン向けベースプラン
              </p>
            </div>
            <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-700">
              まつげサロン人気
            </span>
          </div>

          <div className="mb-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-amber-500">¥7,000</span>
            <span className="text-xs text-slate-700">/ 月（税込）</span>
          </div>

          <ul className="mb-4 space-y-1.5 text-xs text-slate-800">
            <li>・LINE予約ボット（枠管理 / ダブルブッキング防止）</li>
            <li>・メニュー別の施術時間設定（マツエク / ラッシュリフト / 下まつげなど）</li>
            <li>・自動リマインド配信（前日 / 当日）</li>
            <li>・予約一覧ダッシュボード</li>
            <li>・基本カスタマイズ（メニュー・営業時間）</li>
            <li>・チャットサポート</li>
          </ul>

          <a
            href="https://lin.ee/your-line-url"
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center justify-center rounded-lg bg-emerald-400 text-xs font-semibold text-slate-950 hover:bg-emerald-300 active:scale-[0.99] transition"
          >
            このプランで相談する
          </a>
        </div>

        {/* Growth プラン */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Growth
              </p>
              <p className="text-sm font-semibold text-slate-900">
                複数スタッフ・2店舗目以降向け拡張プラン
              </p>
            </div>
          </div>

          <p className="mb-3 text-xs text-slate-800">
            スタッフ数が増えて「どの席が空いているか分かりづらい」
            状態になったタイミングで、<br />
            スタッフ別カレンダーや、売上レポートなどを追加できます。
          </p>

          <p className="mb-4 text-xs font-semibold text-amber-200">
            ¥10,000〜 / 月（内容によりご提案）
          </p>

          <p className="text-[11px] text-slate-700">
            ※ まずはStandardプランからのスタートでOKです。
          </p>
        </div>
      </div>
    </section>
  );
}

function FloatingCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-slate-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-slate-800">
            まずはLINEで相談・デモ希望
          </p>
          <p className="text-[10px] text-slate-700">
            所要時間3分 / 強引な営業は一切なし
          </p>
        </div>
        <a
          href="https://lin.ee/your-line-url"
          target="_blank"
          rel="noreferrer"
          className="flex h-10 flex-1 items-center justify-center rounded-xl bg-emerald-400 text-[11px] font-semibold text-slate-950 hover:bg-emerald-300 active:scale-[0.99] transition"
        >
          💚 LINEで無料相談
        </a>
      </div>
    </div>
  );
}

export default function Landing() {
  // BEFORE / AFTER 用セクション定義（まつげサロン版）
  const beforeAfterSection = {
    id: "before-after",
    title: "導入前と導入後の1日の違い",
    subtitle:
      "Kazuki Booking を入れると、「予約LINEに追われる毎日」から「予約オペはほぼ自動」の状態へシフトできます。",
    style: "luxe-pink",
    before: {
      label: "導入前：LINE対応に追われるオーナー業務",
      description:
        "営業が終わってからも、寝る前まで予約LINEの返信。キャンセルや時間変更が入るたびに手帳を見ながら調整…。",
      bullets: [
        "・営業後も予約LINEの返信が続いて、毎晩クタクタ",
        "・手帳やカレンダーで空き枠管理していて、たまにダブルブッキング",
        "・当日の無断キャンセルが出ても、次の予約を入れ直す余裕がない",
      ],
    },
    after: {
      label: "導入後：予約はLINEボットに任せて、デザインと単価アップに集中",
      description:
        "マツエク・ラッシュリフトのメニュー別施術時間も自動で計算。リマインド配信でドタキャンも減り、リピーターづくりに集中できます。",
      bullets: [
        "・LINEボットが24時間自動で予約受付＆整理",
        "・メニュー別の施術時間を考慮して枠を自動調整",
        "・リマインド配信で当日のドタキャン率を大幅削減",
      ],
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-28">
        <HeroSection />
        <PricingSection />

        {/* BEFORE / AFTER セクション */}
        <div className="mt-12">
          <BeforeAfterSection section={beforeAfterSection} />
        </div>

        {/* 必要ならここに「導入メリット」「FAQ」など追加 */}
      </main>

      <FloatingCta />
    </div>
  );
}
