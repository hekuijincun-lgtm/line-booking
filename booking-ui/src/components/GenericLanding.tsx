import React from "react";

type Theme = {
  primary: string;
  accent: string;
  background: string;
};

type Plan = {
  name: string;
  price: string;
};

export type LpConfig = {
  id: string;
  theme: Theme;
  hero: {
    title: string;
    subtitle: string;
    cta: string;
  };
  pricing: {
    plans: Plan[];
  };
};

export const GenericLanding: React.FC<{ config: LpConfig }> = ({ config }) => {
  const { theme, hero, pricing } = config;

  return (
    <div style={{ backgroundColor: theme.background, minHeight: "100vh" }}>
      {/* Hero */}
      <section
        className="py-16 px-4 md:px-8"
        style={{ backgroundColor: theme.primary, color: "#ffffff" }}
      >
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">
            {hero.title}
          </h1>
          <p className="mt-4 text-base md:text-lg opacity-90">
            {hero.subtitle}
          </p>
          <a
            href="#line-demo"
            className="inline-block mt-8 px-6 py-3 rounded-full font-semibold text-sm md:text-base shadow-lg"
            style={{ backgroundColor: theme.accent, color: "#ffffff" }}
          >
            {hero.cta}
          </a>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6">料金プラン</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {pricing.plans.map((p) => (
              <div
                key={p.name}
                className="p-6 rounded-2xl shadow-lg border border-gray-100 bg-white"
              >
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-3 text-2xl font-bold">{p.price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
