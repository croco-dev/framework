import type { TenantHealthScore } from "./types";

export function cloneTenantHealthScore(score: TenantHealthScore): TenantHealthScore {
  return structuredClone(score);
}
