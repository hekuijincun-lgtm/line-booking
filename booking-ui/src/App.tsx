import React from "react";
import MainLayout from "./layouts/MainLayout";
import BookingShell from "./components/BookingShell";
import { HairOwnerLanding } from "./components/HairOwnerLanding";

const getInitialTemplateId = (): string => {
  if (typeof window === "undefined") return "esthe";
  const params = new URLSearchParams(window.location.search);
  return params.get("template") ?? "esthe";
};

export const App: React.FC = () => {
  const [templateId, setTemplateId] = React.useState<string>(() => getInitialTemplateId());

  React.useEffect(() => {
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

  const showLp = templateId === "hair-owner-lp";

  if (showLp) {
    // LPだけ表示（予約UIは出さない）
    return <HairOwnerLanding />;
  }

  // それ以外は従来どおり予約UIを表示
  return (
    <MainLayout>
      <BookingShell templateId={templateId} />
    </MainLayout>
  );
};

export default App;
