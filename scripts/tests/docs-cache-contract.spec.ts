import { beforeAll, describe, expect, it } from "vitest";

import {
  DOCS_CACHE_EXECUTION_TIMEOUT_MS,
  runDocsCacheContract,
  type DocsCacheContractResult,
} from "../docs-cache-contract.mts";

const SCENARIO_COUNT = 5;
const CONTRACT_TIMEOUT_MS = DOCS_CACHE_EXECUTION_TIMEOUT_MS * SCENARIO_COUNT;

describe("package-granular documentation cache contract", () => {
  let result: DocsCacheContractResult;

  beforeAll(() => {
    result = runDocsCacheContract();
  }, CONTRACT_TIMEOUT_MS);

  function scenario(name: string) {
    const found = result.scenarios.find((candidate) => candidate.name === name);
    expect(found, `missing scenario ${name}`).toBeDefined();
    return found;
  }

  function taskStatus(scenarioName: string, taskId: string) {
    return scenario(scenarioName)?.tasks.find((task) => task.taskId === taskId)?.status;
  }

  it("starts with cold package models, merged API render, and documentation build", () => {
    expect(scenario("initial-run")).toMatchObject({ taskCount: 4, hitCount: 0, missCount: 4 });
  });

  it("reuses every documentation task on an identical second run", () => {
    expect(scenario("identical-second-run")).toMatchObject({
      taskCount: 4,
      hitCount: 4,
      missCount: 0,
    });
  });

  it("invalidates only the consumer model and global tasks after a consumer source change", () => {
    expect(taskStatus("consumer-source-mutation", "@fixture/dependency#docs:api:model")).toBe(
      "HIT",
    );
    expect(taskStatus("consumer-source-mutation", "@fixture/consumer#docs:api:model")).toBe("MISS");
    expect(taskStatus("consumer-source-mutation", "@fixture/docs#docs:api:render")).toBe("MISS");
    expect(taskStatus("consumer-source-mutation", "@fixture/docs#docs:build")).toBe("MISS");
  });

  it("invalidates the affected model closure after a dependency source change", () => {
    for (const taskId of [
      "@fixture/dependency#docs:api:model",
      "@fixture/consumer#docs:api:model",
      "@fixture/docs#docs:api:render",
      "@fixture/docs#docs:build",
    ]) {
      expect(taskStatus("dependency-source-mutation", taskId)).toBe("MISS");
    }
  });

  it("preserves every selected documentation task after an unrelated package change", () => {
    expect(scenario("unrelated-source-mutation")).toMatchObject({
      taskCount: 4,
      hitCount: 4,
      missCount: 0,
    });
  });

  it("bounds each Turbo subprocess to one minute", () => {
    expect(DOCS_CACHE_EXECUTION_TIMEOUT_MS).toBe(60_000);
  });
});
