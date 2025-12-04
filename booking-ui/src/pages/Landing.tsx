import React from "react";
import { lpCatalog } from "../lp-catalog";
import { GenericLanding } from "../components/GenericLanding";

export const LandingPage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const templateId = params.get("template") ?? "hair";

  const config = lpCatalog[templateId];

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold">
            Unknown template: {templateId}
          </p>
          <p className="text-sm text-gray-500">
            ?template=hair または ?template=nail を指定してアクセスしてください。
          </p>
        </div>
      </div>
    );
  }

  return <GenericLanding config={config} />;
};
