import { Container } from "@croco/framework-context";
import { beforeEach, describe, it } from "vitest";
import { createOnboardingStoreConformanceSuite, InMemoryOnboardingStore } from "../index";

describe("InMemoryOnboardingStore conformance", () => {
  beforeEach(() => {
    Container.reset();
  });

  const conformance = createOnboardingStoreConformanceSuite({
    createStore: () => new InMemoryOnboardingStore(),
  });

  for (const testCase of conformance.cases) {
    // oxlint-disable-next-line jest/valid-title -- exported conformance cases own stable names
    it(testCase.name, testCase.run);
  }
});
