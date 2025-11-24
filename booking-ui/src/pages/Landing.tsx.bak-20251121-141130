import React, { useEffect, useState } from "react";
import type { TemplateConfig } from "../lib/template-config";
import { resolveTemplateFromWindow } from "../lib/template-config";
import "../index.css";

type SectionProps = {
  config: TemplateConfig;
  primary: string;
  accent: string;
};

function HeroSection({ config, primary, accent }: SectionProps) {
  const title =
    config.heroCatch ||
    config.title ||
    "予約管理のストレスをゼロにする、LINE予約システム。";
  const sub =
    config.heroSub ||
    "電話・DM・ノート管理から卒業して、施術と単価アップに集中できる毎日へ。";

  const bookingUrl = "http://localhost:5176/"; // TODO: 本番URLに差し替え

  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
        <div
          className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: "#ecfdf5", color: accent }}
        >
          {config.subtitle ?? "オンライン予約 × LINE自動化"}
        </div>

        <h1
          className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: primary }}
        >
          {title}
        </h1>

        <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-600">
          {sub}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <a
            href={bookingUrl}
            className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold shadow-sm ring-2 transition"
            style={{
              backgroundColor: primary,
              color: "#ffffff",
              borderColor: primary,
            }}
          >
            LINEでLINEで無料デモを予約する
          </a>
          <span className="text-xs text-slate-500">
            ※ 24時間オンラインで予約を受け付けできます
          </span>
        </div>

        <div className="mt-6 grid gap-4 text-xs text-slate-500 sm:grid-cols-3">
          <div>✔ 予約対応時間を毎月10〜20時間削減</div>
          <div>✔ 無断キャンセル・ドタキャンの自動フォロー</div>
          <div>✔ LINEだけで完結する予約導線を構築</div>
        </div>
      </div>
    </section>
  );
}

function BeforeAfterSection({ config, primary, accent }: SectionProps) {
  const before = config.before ?? [];
  const after = config.after ?? [];

  if (before.length === 0 && after.length === 0) return null;

  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 pb-10 sm:pb-14">
        <h2
          className="text-xl font-semibold sm:text-2xl"
          style={{ color: primary }}
        >
          導入前と導入後の違い
        </h2>

        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          {before.length > 0 && (
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="text-xs font-semibold text-slate-500">導入前</div>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {before.map((item, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {after.length > 0 && (
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-emerald-100">
              <div
                className="text-xs font-semibold"
                style={{ color: primary }}
              >
                導入後
              </div>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {after.map((item, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span
                      className="mt-[5px] h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ResultsSection({ config, primary }: SectionProps) {
  const results = config.results ?? [];
  if (results.length === 0) return null;

  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 pb-10 sm:pb-14">
        <h2
          className="text-xl font-semibold sm:text-2xl"
          style={{ color: primary }}
        >
          導入イメージ・効果の一例
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {results.map((r, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PricingSection({ config, primary, accent }: SectionProps) {
  const plans = config.pricing ?? [];
  if (plans.length === 0) return null;

  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 pb-10 sm:pb-14">
        <h2
          className="text-xl font-semibold sm:text-2xl"
          style={{ color: primary }}
        >
          導入プラン
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          まずは無理のない範囲でスタートして、運用に慣れたら自動化の範囲を広げることもできます。
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={
                "flex h-full flex-col rounded-2xl border bg-white p-5 text-sm" +
                (plan.highlight ? " border-emerald-400 shadow-md" : " border-slate-200")
              }
            >
              <div className="text-xs font-semibold text-slate-500">
                {plan.name}
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900">
                {plan.price}
              </div>
              <ul className="mt-3 flex-1 space-y-1 text-slate-700">
                {plan.features?.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: plan.highlight ? accent : primary,
                  color: "#ffffff",
                }}
              >
                LINEでこのプランについて相談する
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection({ config, primary }: SectionProps) {
  const faq = config.faq ?? [];
  if (faq.length === 0) return null;

  return (
    <section className="bg-slate-50 pb-16">
      <div className="mx-auto max-w-5xl px-4">
        <h2
          className="text-xl font-semibold sm:text-2xl"
          style={{ color: primary }}
        >
          よくあるご質問
        </h2>
        <div className="mt-4 space-y-4">
          {faq.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-100"
            >
              <div className="font-semibold text-slate-900">Q. {item.q}</div>
              <div className="mt-1 text-slate-700">A. {item.a}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const [config, setConfig] = useState<TemplateConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    resolveTemplateFromWindow(window)
      .then((c) => setConfig(c))
      .catch((err) => {
        console.error("[LP] failed to load template config", err);
        setError("テンプレート設定の読み込みに失敗しました。");
      });
  }, []);

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-2xl px-4 py-16 text-sm text-red-600">
          {error}
        </div>
      </main>
    );
  }

  if (!config) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-2xl px-4 py-16 text-sm text-slate-500">
          読み込み中です…
        </div>
      </main>
    );
  }

  const primary = config.primaryColor || "#065f46";
  const accent = config.accentColor || "#10b981";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <HeroSection config={config} primary={primary} accent={accent} />
      <BeforeAfterSection config={config} primary={primary} accent={accent} />
      <ResultsSection config={config} primary={primary} accent={accent} />
      <PricingSection config={config} primary={primary} accent={accent} />
      <FaqSection config={config} primary={primary} accent={accent} />
    </main>
  );
}

