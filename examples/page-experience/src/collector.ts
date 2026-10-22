import { createPageExperienceCollector } from "../../../packages/frontend-react/src/libs/pageExperienceCollector";
import type { PageExperienceObservation } from "../../../packages/frontend-react/src/libs/pageExperienceCollector";
export function createFixtureCollector(
  pageInstance: string,
  runtime: {
    visible(): boolean;
    monotonic(): number;
    send(rows: readonly PageExperienceObservation[]): Promise<void>;
  },
) {
  return createPageExperienceCollector({
    page: "product",
    pageInstance,
    contentCondition: "hero-visible",
    contentMinIntersectionRatio: 0.5,
    engagementActions: ["preview"],
    valueAction: "purchase",
    enabled: () => true,
    clock: () => Date.now(),
    ...runtime,
    maxBuffer: 32,
    maxAttempts: 2,
  });
}
