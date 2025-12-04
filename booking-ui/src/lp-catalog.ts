import hair from "./lp-profiles/hair.json";
import nail from "./lp-profiles/nail.json";

export const lpCatalog: Record<string, any> = {
  hair,
  nail,
};

export type LpId = keyof typeof lpCatalog;
