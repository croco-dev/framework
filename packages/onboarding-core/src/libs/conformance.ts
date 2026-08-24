import * as assert from "node:assert/strict";

import type { OnboardingStore } from "./OnboardingStore";
import type { OnboardingState } from "./types";

export type OnboardingStoreConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type OnboardingStoreConformanceOptions = {
  readonly createStore: () => OnboardingStore | Promise<OnboardingStore>;
};

export type OnboardingStoreConformanceSuite = {
  readonly cases: readonly OnboardingStoreConformanceCase[];
};

export function createOnboardingStoreConformanceSuite(
  options: OnboardingStoreConformanceOptions,
): OnboardingStoreConformanceSuite {
  return {
    cases: [
      {
        name: "round-trips every public lifecycle field through create and update",
        run: async () => {
          const store = await options.createStore();
          const initialState: OnboardingState = {
            steps: { profile: { completed: false } },
            isCompleted: false,
            completedAt: undefined,
            status: "in_progress",
            startedAt: new Date("2026-08-20T00:00:00.000Z"),
            currentStepId: "profile",
          };
          await store.saveState("conformance-tenant", "conformance-user", "welcome", initialState);

          assertStateEqual(
            await store.getState("conformance-tenant", "conformance-user", "welcome"),
            initialState,
          );

          const completedAt = new Date("2026-08-21T00:00:00.000Z");
          const updatedState: OnboardingState = {
            steps: { profile: { completed: true, completedAt } },
            isCompleted: true,
            completedAt,
            status: "completed",
            startedAt: new Date("2026-08-19T00:00:00.000Z"),
            currentStepId: "done",
          };
          await store.saveState("conformance-tenant", "conformance-user", "welcome", updatedState);

          assertStateEqual(
            await store.getState("conformance-tenant", "conformance-user", "welcome"),
            updatedState,
          );

          const clearedState: OnboardingState = {
            ...updatedState,
            completedAt: undefined,
            status: undefined,
            startedAt: undefined,
            currentStepId: undefined,
          };
          await store.saveState("conformance-tenant", "conformance-user", "welcome", clearedState);

          assertStateEqual(
            await store.getState("conformance-tenant", "conformance-user", "welcome"),
            clearedState,
          );
        },
      },
    ],
  };
}

function assertStateEqual(actual: OnboardingState | null, expected: OnboardingState): void {
  assert.ok(actual, "Onboarding store conformance expected a persisted state, got null.");
  assert.deepEqual(actual, expected);
}
