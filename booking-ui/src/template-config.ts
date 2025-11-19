/**
 * Kazuki Booking - TemplateConfig (JSON backend)
 *  - PowerShell が YAML => JSON に変換
 *  - フロントは /templates/<slug>.json を fetch するだけ
 */

export type TemplateFeatureItem = {
  title: string;
  description: string;
};

export type TemplateSection = {
  type: string;
  title: string;
  items: TemplateFeatureItem[];
};

export type TemplateHero = {
  title: string;
  subtitle: string;
  description: string;
  image: string;
  ctaLabel: string;
};

export type TemplateBrand = {
  primary: string;
  accent: string;
  surface: string;
};

export type TemplateMeta = {
  tags: string[];
  note: string;
};

export type TemplateConfig = {
  name: string;
  slug: string;
  brand: TemplateBrand;
  layout: {
    hero: TemplateHero;
    sections: TemplateSection[];
  };
  meta: TemplateMeta;
};

export async function loadTemplateConfig(slug: string): Promise<TemplateConfig> {
  if (!slug) {
    throw new Error("loadTemplateConfig: slug is required");
  }

  const res = await fetch(/templates/.json, {
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      loadTemplateConfig: failed to load template '': HTTP 
    );
  }

  const data = (await res.json()) as TemplateConfig;
  if (!data.slug) {
    data.slug = slug;
  }

  return data;
}
