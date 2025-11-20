import React from "react";
import { HairOwnerLanding } from "./components/HairOwnerLanding";
import LegacyApp from "./LegacyApp";

/**
 * クエリパラメータから template を読むユーティリティ
 * SSR 回避のため window チェック付き
 */
const getTemplateFromLocation = (): string => {
  if (typeof window === "undefined") return "esthe";
  const params = new URLSearchParams(window.location.search);
  return params.get("template") ?? "esthe";
};

export const App: React.FC = () => {
  const [templateId, setTemplateId] = React.useState<string>(() =>
    getTemplateFromLocation(),
  );

  React.useEffect(() => {
    const handler = () => {
      setTemplateId(getTemplateFromLocation());
    };

    window.addEventListener("popstate", handler);
    window.addEventListener("pushstate", handler as any);
    window.addEventListener("replacestate", handler as any);

    return () => {
      window.removeEventListener("popstate", handler);
      window.removeEventListener("pushstate", handler as any);
      window.removeEventListener("replacestate", handler as any);
    };
  }, []);

  const isHairOwnerLp = templateId === "hair-owner-lp";

  if (isHairOwnerLp) {
    // 美容室オーナー向け LP だけ表示
    return <HairOwnerLanding />;
  }

  // それ以外は従来の予約UI（LegacyApp）をそのまま表示
  return <LegacyApp />;
};

export default App;
