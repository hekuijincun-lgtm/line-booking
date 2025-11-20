import React from "react";
import { HairOwnerLanding } from "./components/HairOwnerLanding";

const getInitialTemplateId = (): string => {
  if (typeof window === "undefined") return "esthe";
  const params = new URLSearchParams(window.location.search);
  return params.get("template") ?? "esthe";
};

export const App: React.FC = () => {
  const [templateId, setTemplateId] = React.useState<string>(() => getInitialTemplateId());

  React.useEffect(() => {
    // URL が変わったときにも反映できるように一応イベントを仕込んでおく（保険）
    const handler = () => {
      setTemplateId(getInitialTemplateId());
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

  return (
    <>
      {/* ▼ template=hair-owner-lp のときだけ LP セクションを表示 */}
      {isHairOwnerLp && <HairOwnerLanding />}

      {/* ▼ ここに「元の App.tsx の中身（return の中）」をそのまま貼る */}
      {/* 例：もともと
            return (
              <MainLayout>
                <BookingShell ... />
              </MainLayout>
            );
          だった場合、
          <MainLayout>〜</MainLayout> の部分をそのまま下に貼り付ける */}
      {/* ★ここに元の中身をそのまま貼る★ */}
    </>
  );
};

export default App;
