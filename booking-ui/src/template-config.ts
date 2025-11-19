export type TemplateConfig = {
  id: string;
  title: string;
  subtitle?: string;
  envLabel?: string;
  primaryColor?: string;
  accentColor?: string;
};

const TEMPLATE_BASE_PATH = "/templates";

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

export async function loadTemplateConfig(templateId: string): Promise<TemplateConfig> {
  if (!templateId) {
    throw new TemplateConfigError("missingTemplateParam");
  }

  const url = TEMPLATE_BASE_PATH + "/" + templateId + ".json";

  try {
    const cfg = await fetchJson<TemplateConfig>(url);

    if (!cfg.id) {
      cfg.id = templateId;
    }
    if (!cfg.title) {
      cfg.title = "Kazuki Booking";
    }

    return cfg;
  } catch (err) {
    console.error("[template-config] failed to load template config", err);

    // エラー時も UI が動くようにフォールバック
    return {
      id: templateId,
      title: "Kazuki Booking",
      subtitle: "オンライン予約",
      envLabel: "ENV: staging"
    };
  }
}

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
