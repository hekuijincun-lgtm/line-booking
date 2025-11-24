//-------------------------------------------------------------
// LP テンプレート構成
//-------------------------------------------------------------
export type TemplateConfig = {
  id: string;
  title: string;
  subtitle?: string;
  envLabel?: string;
  primaryColor?: string;
  accentColor?: string;

  // ★ LP専用追加項目
  heroCatch?: string;
  heroSub?: string;

  before?: string[];
  after?: string[];

  pricing?: {
    name: string;
    price: string;
    features: string[];
    highlight?: boolean;
  }[];

  results?: string[]; // 実績・効果
  faq?: { q: string; a: string }[];
};

const TEMPLATE_BASE_PATH = "/templates";

//-------------------------------------------------------------
// エラーメッセージ
//-------------------------------------------------------------
const errorMessages = {
  missingTemplateParam: "template パラメータが指定されていません。",
  templateNotFound: "指定されたテンプレートが見つかりません。",
  failedToLoadTemplate: "テンプレート設定の取得に失敗しました。",
  loadTemplateConfig: "テンプレート設定の取得に失敗しました。"
} as const;

export type TemplateErrorKey = keyof typeof errorMessages;

export class TemplateConfigError extends Error {
  public readonly key: TemplateErrorKey;

  constructor(key: TemplateErrorKey, detail?: string) {
    const base = errorMessages[key];
    const msg = detail ? base + " (" + detail + ")" : base;
    super(msg);
    this.name = "TemplateConfigError";
    this.key = key;
  }
}

//-------------------------------------------------------------
// JSON読み込み
//-------------------------------------------------------------
async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "GET" });
  if (!res.ok) {
    throw new TemplateConfigError(
      "failedToLoadTemplate",
      "HTTP " + res.status + " " + res.statusText
    );
  }
  return (await res.json()) as T;
}

//-------------------------------------------------------------
// 設定ロード
//-------------------------------------------------------------
export async function loadTemplateConfig(templateId: string): Promise<TemplateConfig> {
  if (!templateId) {
    throw new TemplateConfigError("missingTemplateParam");
  }

  const url = TEMPLATE_BASE_PATH + "/" + templateId + ".json";

  try {
    const cfg = await fetchJson<TemplateConfig>(url);

    // 不足項目フォールバック
    return {
      id: templateId,
      title: cfg.title ?? "Kazuki Booking",
      subtitle: cfg.subtitle ?? "オンライン予約",
      envLabel: cfg.envLabel ?? "ENV: staging",
      primaryColor: cfg.primaryColor ?? "#0f172a",
      accentColor: cfg.accentColor ?? "#facc15",

      heroCatch: cfg.heroCatch ?? "",
      heroSub: cfg.heroSub ?? "",

      before: cfg.before ?? [],
      after: cfg.after ?? [],

      pricing: cfg.pricing ?? [],
      results: cfg.results ?? [],
      faq: cfg.faq ?? []
    };
  } catch (err) {
    console.error("[template-config] failed to load template config", err);

    // 何があってもLPが壊れないように最低限の構成を返す
    return {
      id: templateId,
      title: "Kazuki Booking",
      subtitle: "オンライン予約",
      envLabel: "ENV: staging",
      heroCatch: "予約対応を手放して施術に集中しませんか？",
      heroSub: "LINEで自動受付・自動リマインド・空き枠管理を一括化",
      before: [],
      after: [],
      pricing: [],
      results: [],
      faq: []
    };
  }
}

//-------------------------------------------------------------
// location / window からテンプレート解決
//-------------------------------------------------------------
export async function resolveTemplateFromLocation(
  location: Location
): Promise<TemplateConfig> {
  const search = location.search || "";
  const params = new URLSearchParams(search);
  const templateId = params.get("template") || "esthe";
  return loadTemplateConfig(templateId);
}

export async function resolveTemplateFromWindow(
  win: Window
): Promise<TemplateConfig> {
  return resolveTemplateFromLocation(win.location);
}


