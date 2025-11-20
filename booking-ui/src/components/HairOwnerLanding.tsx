import React from "react";
import { motion } from "framer-motion";

const fadeInUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const fadeInCard = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// CTA押したときに予約フォーム付近まで「にゅーん」とスクロールさせる
const scrollToBooking = () => {
  if (typeof window === "undefined") return;

  const target =
    document.getElementById("booking-form") ||
    (document.querySelector("[data-booking-root]") as HTMLElement | null);

  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    // フォームが特定できない場合は、とりあえずページ下部までスクロール
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }
};

/**
 * 美容室オーナー向け LP セクション（スクロール演出＋CTAスクロール付き）
 */
export const HairOwnerLanding: React.FC = () => {
  return (
    <section className="mx-auto mb-12 mt-6 max-w-4xl space-y-10 px-4 md:mt-8 md:space-y-12">
      {/* Hero */}
      <motion.div
        className="rounded-3xl bg-white px-6 py-7 shadow-md md:px-8 md:py-9"
        variants={fadeInUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <p className="mb-4 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-700">
          美容室オーナー向け予約ツール
        </p>
        <h1 className="mb-3 text-2xl font-semibold leading-snug text-slate-900 md:text-3xl">
          予約管理のストレスをゼロへ。
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600 md:text-[15px]">
          もう「電話対応」「ダブルブッキング」「空き枠の反映漏れ」に悩まない美容室へ。
          予約作業はツールに任せて、ハサミに集中できる毎日へ。
        </p>
      </motion.div>

      {/* Before / After */}
      <motion.div
        className="rounded-3xl bg-white px-6 py-7 shadow-md md:px-8 md:py-8"
        variants={fadeInCard}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
      >
        <h2 className="mb-5 text-lg font-semibold text-slate-900 md:text-xl">
          導入前と導入後の違い
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">導入前</h3>
            <ul className="list-inside list-disc space-y-1.5 text-[13px] leading-relaxed text-slate-600">
              <li>予約の電話対応で施術が中断される</li>
              <li>紙やノートでの管理で記入ミスが不安</li>
              <li>空き枠の管理がめんどくさい</li>
              <li>SNSからの予約導線が弱い</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">導入後</h3>
            <ul className="list-inside list-disc space-y-1.5 text-[13px] leading-relaxed text-slate-600">
              <li>LINEで自動受付されるので施術に集中できる</li>
              <li>予約枠は一括登録＆自動管理でミス削減</li>
              <li>空き枠はカレンダーと連動して自動反映</li>
              <li>InstagramやLINEからそのまま予約に繋がる</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Pricing */}
      <motion.div
        className="rounded-3xl bg-white px-6 py-7 shadow-md md:px-8 md:py-8"
        variants={fadeInCard}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.08 }}
      >
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 md:text-xl">
              料金プラン（例）
            </h2>
            <p className="mt-1 text-[11px] text-slate-500 md:text-xs">
              ※ サロンの規模に合わせて柔軟に変更可能です。
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col rounded-2xl border border-slate-100 px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md">
            <p className="mb-1 text-xs font-semibold text-slate-500">ライトプラン</p>
            <p className="mb-1 text-base font-semibold text-slate-900">月額 5,000円〜</p>
            <p className="mb-2 text-[11px] text-slate-500">LINE予約 + カレンダー連携</p>
            <ul className="mt-auto list-inside list-disc space-y-1 text-[11px] leading-relaxed text-slate-600">
              <li>LINEからの自動予約受付</li>
              <li>基本的な予約枠管理</li>
              <li>スマホ対応の予約画面</li>
            </ul>
          </div>
          <div className="relative flex flex-col rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <span className="absolute -top-2 right-4 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
              おすすめ
            </span>
            <p className="mb-1 text-xs font-semibold text-amber-700">スタンダードプラン</p>
            <p className="mb-1 text-base font-semibold text-slate-900">月額 8,000円〜</p>
            <p className="mb-2 text-[11px] text-slate-500">
              予約枠管理 + リピート導線強化
            </p>
            <ul className="mt-auto list-inside list-disc space-y-1 text-[11px] leading-relaxed text-slate-600">
              <li>ライトプランの全機能</li>
              <li>リピート導線を意識した予約導線</li>
              <li>人気メニューや時間帯の簡易分析</li>
            </ul>
          </div>
          <div className="flex flex-col rounded-2xl border border-slate-100 px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md">
            <p className="mb-1 text-xs font-semibold text-slate-500">プロプラン</p>
            <p className="mb-1 text-base font-semibold text-slate-900">月額 10,000円〜</p>
            <p className="mb-2 text-[11px] text-slate-500">
              小規模サロンの“予約担当者”代わりに
            </p>
            <ul className="mt-auto list-inside list-disc space-y-1 text-[11px] leading-relaxed text-slate-600">
              <li>スタンダードプランの全機能</li>
              <li>Slack通知などの運営向け通知</li>
              <li>今後の自動決済・自動営業機能の優先提供</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Reviews */}
      <motion.div
        className="rounded-3xl bg-white px-6 py-7 shadow-md md:px-8 md:py-8"
        variants={fadeInCard}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-900 md:text-xl">
          サロンオーナーの声（イメージ）
        </h2>
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
            <p className="mb-1 text-[11px] font-semibold text-slate-600">
              1人で切り盛りする美容室オーナー様
            </p>
            <p className="text-[12px] leading-relaxed text-slate-600">
              「施術中に予約の電話が鳴らなくなっただけで本当に助かってます。LINEで勝手に予約が入るので、カットに集中できる時間が増えました。」
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
            <p className="mb-1 text-[11px] font-semibold text-slate-600">
              郊外の小さなサロンオーナー様
            </p>
            <p className="text-[12px] leading-relaxed text-slate-600">
              「今までノートで管理していたときより、予約ミスがゼロに。1人営業でも“ちゃんとしたサロン”として見られるようになった気がします。」
            </p>
          </div>
          <p className="text-[11px] text-slate-400">
            ※ 実際の導入サロンの声が集まり次第、ここは差し替え・追記できます。
          </p>
        </div>
      </motion.div>

      {/* FAQ + Policy */}
      <motion.div
        className="rounded-3xl bg-white px-6 py-7 shadow-md md:px-8 md:py-8"
        variants={fadeInCard}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.12 }}
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-900 md:text-xl">
          よくあるご質問
        </h2>
        <div className="space-y-3">
          <div>
            <p className="text-[13px] font-semibold text-slate-700">
              Q. 導入は難しくないですか？
            </p>
            <p className="text-[12px] leading-relaxed text-slate-600">
              A. 基本的には「予約枠を入力するだけ」で自動化できます。スマホでLINEを使える方なら、そのまま使えるくらいの難易度です。
            </p>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-slate-700">
              Q. 決済機能は必須ですか？
            </p>
            <p className="text-[12px] leading-relaxed text-slate-600">
              A. 決済機能なしでもご利用可能です。まずは予約の自動化からスタートして、必要に応じて今後の自動決済機能を追加できます。
            </p>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-slate-700">
              Q. 月途中の解約はできますか？
            </p>
            <p className="text-[12px] leading-relaxed text-slate-600">
              A. はい、いつでも解約可能です。まずは小さく試していただいて、合うと感じたら継続いただく形を想定しています。
            </p>
          </div>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h3 className="mb-1 text-[13px] font-semibold text-slate-700">
            キャンセルについて（例）
          </h3>
          <ul className="list-inside list-disc space-y-1 text-[12px] leading-relaxed text-slate-600">
            <li>当日キャンセル：キャンセル料は原則いただきません。</li>
            <li>無断キャンセルが複数回続く場合は、次回以降の予約をお断りする場合があります。</li>
            <li>美容室ごとの運用ルールに合わせて柔軟に変更可能です。</li>
          </ul>
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        className="rounded-3xl bg-slate-900 px-6 py-8 text-center text-white shadow-md md:px-8 md:py-9"
        variants={fadeInUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.45, ease: "easeOut", delay: 0.14 }}
      >
        <p className="mb-2 text-sm font-semibold md:text-base">
          今の予約管理、そろそろ手放してみませんか？
        </p>
        <p className="mb-5 text-[12px] leading-relaxed text-slate-200 md:text-sm">
          まずは「空き時間の予約受付だけ」からでもOK。1人サロンでも無理なく始められます。
        </p>
        <div className="flex flex-col gap-2 md:flex-row md:justify-center">
          <button
            type="button"
            onClick={scrollToBooking}
            className="inline-flex items-center justify-center rounded-full bg-amber-400 px-6 py-2.5 text-[13px] font-semibold text-slate-900 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-md"
          >
            今すぐLINEで予約管理を自動化する
          </button>
          <button
            type="button"
            onClick={scrollToBooking}
            className="inline-flex items-center justify-center rounded-full border border-slate-500 px-6 py-2.5 text-[13px] font-semibold text-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md"
          >
            導入の相談をしてみる
          </button>
        </div>
      </motion.div>
    </section>
  );
};
