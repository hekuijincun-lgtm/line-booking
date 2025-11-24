import * as React from "react";

type LpSection = {
  type: string;
  html?: string;
  // 将来 pricing / steps などを追加する場合ここにフィールドを増やす
};

type LpTemplate = {
  id?: string;
  title?: string;
  sections?: LpSection[];
};

const FloatingCta: React.FC = () => {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-slate-800">
            まずはLINEで相談・デモ希望
          </p>
          <p className="text-[10px] text-slate-500">
            所要時間3分 / 強引な営業・しつこい連絡は一切なし
          </p>
        </div>
        <a
          href="https://lin.ee/your-line-url"
          target="_blank"
          rel="noreferrer"
          className="flex h-10 flex-1 items-center justify-center rounded-full bg-sky-800 text-[11px] font-semibold text-white transition hover:bg-sky-700 active:scale-[0.99]"
        >
          💚 LINEで無料デモを見る
        </a>
      </div>
    </div>
  );
};

const Landing: React.FC = () => {
  const [template, setTemplate] = React.useState<LpTemplate | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // ?template=xxx を取得（なければ hair-owner-lp-soft-v2 をデフォルトに）
  const search = new URLSearchParams(window.location.search);
  const templateId = search.get("template") ?? "hair-owner-lp-soft-v2";

  React.useEffect(() => {
    let cancelled = false;

    async function loadTemplate() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/templates/${templateId}.json`, {
          method: "GET",
        });

        if (!res.ok) {
          throw new Error(`Failed to load template: ${res.status}`);
        }

        const json = (await res.json()) as LpTemplate;
        if (!cancelled) {
          setTemplate(json);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("テンプレートの読み込みに失敗しました。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] text-slate-900 flex items-center justify-center">
        <p className="text-sm text-slate-600">読み込み中です...</p>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] text-slate-900 flex items-center justify-center">
        <div className="max-w-md px-4 text-center">
          <p className="mb-2 text-sm font-semibold text-red-600">エラー</p>
          <p className="text-xs text-slate-600">
            {error ?? "テンプレートが見つかりませんでした。URLの template パラメータを確認してください。"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-900">
      <main className="mx-auto max-w-5xl px-0 pt-6 pb-28 md:px-0 md:pt-8">
        {template.sections?.map((section, index) => {
          // 今は type: "html" をメインで扱う
          if (section.type === "html" && section.html) {
            return (
              <div
                key={index}
                // section.html 側に <section> やスタイルが入っている想定なので div ラッパーにしている
                dangerouslySetInnerHTML={{ __html: section.html }}
              />
            );
          }

          // TODO: type === "pricing" / "steps" などを将来ここでハンドリング
          return null;
        })}
      </main>
      <FloatingCta />
    </div>
  );
};

export default Landing;
