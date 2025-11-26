import React from "react";

const LINE_CTA_URL = "https://lin.ee/ovVekXY";

export type HairOwnerLandingContent = {
  hero: {
    badge: string;
    title: string;
    /** 例: "Kazuki Booking は " */
    leadPrefix: string;
    /** 例: "人力で回している予約運営 を自動化するLINE予約仕組み化パッケージ" */
    leadEmphasis: string;
    /** 例: " です。" */
    leadSuffix: string;
  };
  beforeAfter: {
    beforeTitle: string;
    beforeItems: string[];
    afterTitle: string;
    afterItems: string[];
  };
  mainCta: {
    title: string;
    body: string;
    buttonLabel: string;
    note: string;
  };
  pricing: {
    title: string;
    note: string;
    plans: {
      name: string;
      price: string;
      highlight?: boolean;
      highlightLabel?: string; // 例: "スタンダード（人気）"
      features: string[];
    }[];
  };
  afterIntro: {
    title: string;
    items: string[];
  };
  faq: {
    title: string;
    items: {
      question: string;
      answer: string;
    }[];
  };
  footerCta: {
    eyebrow: string;
    description: string;
    buttonLabel: string;
  };
};

type Props = {
  content: HairOwnerLandingContent;
};

export const HairOwnerLanding: React.FC<Props> = ({ content }) => {
  const handleClick = () => window.open(LINE_CTA_URL, "_blank");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 space-y-8">
        {/* HERO */}
        <section className="space-y-3">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
            {content.hero.badge}
          </p>
          <h1 className="text-2xl font-bold leading-tight">
            {content.hero.title}
          </h1>
          <p className="text-sm text-slate-600">
            {content.hero.leadPrefix}
            <span className="font-semibold">{content.hero.leadEmphasis}</span>
            {content.hero.leadSuffix}
          </p>
        </section>

        {/* Before / After */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-rose-100 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-rose-500">
              {content.beforeAfter.beforeTitle}
            </p>
            <ul className="text-xs text-slate-700 space-y-1.5">
              {content.beforeAfter.beforeItems.map((item, idx) => (
                <li key={idx}>・{item}</li>
              ))}
            </ul>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-600">
              {content.beforeAfter.afterTitle}
            </p>
            <ul className="text-xs text-slate-800 space-y-1.5">
              {content.beforeAfter.afterItems.map((item, idx) => (
                <li key={idx}>・{item}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* メインCTA */}
        <section className="bg-white text-slate-900 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-semibold">{content.mainCta.title}</h2>
          <p className="text-sm text-slate-600">
            {content.mainCta.body}
          </p>
          <button
            onClick={handleClick}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-xs font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300 transition"
          >
            {content.mainCta.buttonLabel}
          </button>
          <p className="text-[10px] text-slate-400 mt-1">
            {content.mainCta.note}
          </p>
        </section>

        {/* 料金イメージ */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-base font-semibold">{content.pricing.title}</h2>
          <p className="text-xs text-slate-900">
            {content.pricing.note}
          </p>
          <div className="grid md:grid-cols-3 gap-4 text-xs">
            {content.pricing.plans.map((plan, index) => {
              const isHighlight = plan.highlight;
              const baseClasses =
                "border rounded-2xl p-4 space-y-1";
              const highlightClasses = isHighlight
                ? "border-amber-300 bg-amber-50"
                : "border-slate-200";

              return (
                <div
                  key={index}
                  className={`${baseClasses} ${highlightClasses}`}
                >
                  <p
                    className={
                      isHighlight
                        ? "font-semibold text-amber-700"
                        : "font-semibold"
                    }
                  >
                    {plan.highlightLabel ?? plan.name}
                  </p>
                  <p className="text-sm font-bold">{plan.price}</p>
                  <ul className="text-slate-600 space-y-1">
                    {plan.features.map((feature, i) => (
                      <li key={i}>・{feature}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* 導入イメージ */}
        <section className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-3">
          <h2 className="text-base font-semibold">
            {content.afterIntro.title}
          </h2>
          <ul className="text-xs text-slate-700 space-y-1.5">
            {content.afterIntro.items.map((item, idx) => (
              <li key={idx}>・{item}</li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-base font-semibold">{content.faq.title}</h2>

          <div className="space-y-3 text-sm text-slate-700">
            {content.faq.items.map((faqItem, idx) => (
              <div key={idx}>
                <p className="font-semibold">Q. {faqItem.question}</p>
                <p className="text-slate-600">A. {faqItem.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* フッター固定 CTA */}
      <div className="fixed inset-x-0 bottom-0 bg-white text-slate-900">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-[11px] leading-tight">
            <div className="font-semibold">
              {content.footerCta.eyebrow}
            </div>
            <div className="text-slate-500">
              {content.footerCta.description}
            </div>
          </div>
          <button
            onClick={handleClick}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300 transition"
          >
            {content.footerCta.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
