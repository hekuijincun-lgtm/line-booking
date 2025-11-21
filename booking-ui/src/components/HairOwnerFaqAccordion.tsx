import React, { useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
};

const faqs: FaqItem[] = [
  {
    question: "ホットペッパーと併用できますか？",
    answer:
      "はい、併用可能です。まずは既存の媒体はそのままに、自前のLINE導線を少しずつ育てていく形をおすすめしています。",
  },
  {
    question: "複数店舗でも使えますか？",
    answer:
      "はい。プランによって店舗ごとの管理やスタッフアカウントの分離も可能です。まずは1店舗からスタートして、順次拡大もできます。",
  },
  {
    question: "スタッフのシフト変更にも対応できますか？",
    answer:
      "はい。シフト変更に合わせて空き枠を更新できるよう設計します。自動化の度合いはサロンの運用スタイルに合わせて調整可能です。",
  },
];

export const HairOwnerFaqAccordion: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="mt-16 lg:mt-20">
      <h2 className="text-2xl font-semibold text-emerald-900 mb-6">
        よくあるご質問
      </h2>
      <div className="space-y-4">
        {faqs.map((item, index) => {
          const isOpen = openIndex === index;

          return (
            <div
              key={item.question}
              className="rounded-2xl bg-white shadow-sm border border-emerald-50"
            >
              <button
                type="button"
                className="w-full px-6 py-4 flex items-center justify-between text-left"
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <span className="font-medium text-emerald-900">
                  Q. {item.question}
                </span>
                <span className="ml-3 text-emerald-500 text-lg">
                  {isOpen ? "－" : "＋"}
                </span>
              </button>

              {isOpen && (
                <div className="px-6 pb-5 pt-0 text-sm leading-relaxed text-slate-700">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
