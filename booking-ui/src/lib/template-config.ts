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

function getTemplateIdFromUrl(search: string): string {
  const params = new URLSearchParams(search);
  const id = params.get("template");
  if (!id) {
    throw new TemplateConfigError("missingTemplateParam");
  }
  return id;
}

function buildTemplateJsonPath(id: string): string {
  return TEMPLATE_BASE_PATH + "/" + id + ".json";
}

export async function loadTemplateConfig(templateId: string): Promise<TemplateConfig> {
  const path = buildTemplateJsonPath(templateId);
  try {
    return await fetchJson<TemplateConfig>(path);
  } catch (err) {
    if (err instanceof TemplateConfigError) {
      throw err;
    }
    throw new TemplateConfigError("loadTemplateConfig", String(err));
  }
}

export async function loadTemplateConfigFromLocation(loc: Location): Promise<TemplateConfig> {
  const id = getTemplateIdFromUrl(loc.search);
  return loadTemplateConfig(id);
}

export const TEMPLATE_JSON_PATH = "/templates/template-config.json";

export async function loadAllTemplateConfigs(): Promise<TemplateConfig[]> {
  try {
    return await fetchJson<TemplateConfig[]>(TEMPLATE_JSON_PATH);
  } catch (err) {
    if (err instanceof TemplateConfigError) {
      throw err;
    }
    throw new TemplateConfigError("loadTemplateConfig", String(err));
  }
}





