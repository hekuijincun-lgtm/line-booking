import React, { useEffect, useMemo, useState } from "react";
import {
  HairOwnerLanding,
  type HairOwnerLandingContent,
} from "./components/HairOwnerLanding";

type TemplateId = "hair-owner-lp-soft";

type TemplateDef = {
  id: TemplateId;
  jsonPath: string;
  component: React.ComponentType<{ content: HairOwnerLandingContent }>;
};

const TEMPLATE_MAP: Record<TemplateId, TemplateDef> = {
  "hair-owner-lp-soft": {
    id: "hair-owner-lp-soft",
    jsonPath: "/templates/hair-owner-lp-soft.json",
    component: HairOwnerLanding,
  },
};

// JSON と同じ構造のフォールバックデータ
const FALLBACK_HAIR_OWNER_SOFT: HairOwnerLandingContent = {
  hero: {
    badge: "美容室オーナー向け予約 × 自動リマインド",
    title: "電話対応とDMのラッシュで1日が溶けるサロン運営を卒業しませんか？",
    leadPrefix: "Kazuki Booking は ",
    leadEmphasis: "人力で回している予約運営 を自動化するLINE予約仕組み化パッケージ",
    leadSuffix: " です。",
  },
  beforeAfter: {
    beforeTitle: "Before（導入前）",
    beforeItems: [
      "電話・DM対応で毎日1〜2時間奪われる",
      "予約管理がノート / LINE / ホットペッパーでバラつく",
      "予約抜け・ダブルブッキングが常に怖い",
      "新規は来るのに2回目に繋がらない",
      "値下げしないと新規が動かない気がする",
    ],
    afterTitle: "After（導入後）",
    afterItems: [
      "予約はすべてLINEが自動受付 → 施術に集中できる",
      "空き枠・キャンセル・リマインドの自動化",
      "理想の客層だけが集まる予約導線をLINEに構築",
      "来店履歴とメニューから次回提案が簡単",
      "オーナー不在でも予約運営が止まらない",
    ],
  },
  mainCta: {
    title:
      "まずは「今の予約導線のどこがボトルネック？」を一緒に棚卸ししませんか？",
    body:
      "現状をLINEで送ってもらうだけで、あなたのサロンにとって一番コスパのいい一手を提案します。",
    buttonLabel: "LINEで無料トライアル相談をする",
    note: "※強引な営業は一切なし／スタンプだけで終了OK",
  },
  pricing: {
    title: "料金イメージ",
    note:
      "サロンの席数・スタッフ数・メニュー構成に合わせて個別にお見積りします。下記はあくまで目安の料金です。",
    plans: [
      {
        name: "ライトプラン",
        price: "月額 19,800円〜",
        highlight: false,
        features: [
          "LINE予約＋カレンダー連携",
          "基本的な自動リマインド",
          "個人サロン / 席数少なめ向け",
        ],
      },
      {
        name: "スタンダード",
        highlight: true,
        highlightLabel: "スタンダード（人気）",
        price: "月額 29,800円〜",
        features: [
          "リピートを意識した予約導線設計",
          "キャンセル穴埋め用の一斉配信サポート",
          "2〜4席のサロンにおすすめ",
        ],
      },
      {
        name: "プレミアム",
        price: "月額 49,800円〜",
        highlight: false,
        features: [
          "複数スタッフ / 複数メニューの同時管理",
          "回数券 / サブスクメニューに対応",
          "2店舗展開を見据えた設計相談",
        ],
      },
    ],
  },
  afterIntro: {
    title: "導入後のイメージ",
    items: [
      "毎日の電話対応がほぼゼロに（LINEが一次対応）",
      "予約カレンダーと来店履歴が1つの画面で確認できる",
      "2回目・3回目に繋がるメッセージが自動で届く",
      "売上の山谷が見える化され、打ち手を考えやすくなる",
    ],
  },
  faq: {
    title: "よくあるご質問",
    items: [
      {
        question:
          "予約管理がバラバラで、まず何から整理すればいいか分かりません。",
        answer:
          "現状のスクリーンショットやノートの写真をLINEで送ってもらうだけで大丈夫です。そこから「どこを自動化すると一番ラクになるか」を一緒に決めていきます。",
      },
      {
        question: "ITが苦手でも使いこなせますか？",
        answer:
          "日常的な操作はすべてスマホのLINE上で完結する設計です。初期設定もオンラインで一緒に画面を見ながら進めます。",
      },
      {
        question: "いつから使い始められますか？",
        answer:
          "必要な情報が揃っていれば、最短即日〜平均3日ほどで運用開始できます。",
      },
      {
        question: "強引な営業や長期契約はありますか？",
        answer:
          "ありません。まずは無料トライアル相談で相性を確認していただき、合わないと感じた場合はスタンプ一つで終了していただけます。",
      },
    ],
  },
  footerCta: {
    eyebrow: "＼ 電話対応に追われないサロンへ ／",
    description: "まずはLINEで無料トライアル相談（1分で完了）",
    buttonLabel: "LINEで無料トライアル相談をする",
  },
};

function getTemplateIdFromLocation(): TemplateId {
  if (typeof window === "undefined") {
    return "hair-owner-lp-soft";
  }

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("template") as TemplateId | null;

  if (fromQuery && Object.hasOwn(TEMPLATE_MAP, fromQuery)) {
    return fromQuery;
  }

  return "hair-owner-lp-soft";
}

export const LpViewer: React.FC = () => {
  const [content, setContent] = useState<HairOwnerLandingContent>(
    FALLBACK_HAIR_OWNER_SOFT
  );

  const templateId = useMemo(() => getTemplateIdFromLocation(), []);
  const template = TEMPLATE_MAP[templateId];
  const Component = template.component;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(template.jsonPath, {
          headers: {
            "Cache-Control": "no-cache",
          },
        });

        if (!res.ok) {
          console.warn(
            "[LpViewer] JSON fetch failed:",
            template.jsonPath,
            res.status,
            res.statusText
          );
          return;
        }

        const data = (await res.json()) as HairOwnerLandingContent;

        if (!cancelled && data) {
          setContent(data);
        }
      } catch (e) {
        console.error("[LpViewer] JSON fetch error:", e);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [template.jsonPath]);

  return <Component content={content} />;
};
