import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import {
  assertTurboCacheContract,
  runTurboCacheContract,
  TURBO_EXECUTION_TIMEOUT_MS,
  type TurboCacheContractResult,
} from "../turbo-cache-contract.mts";

const TURBO_CACHE_SCENARIO_COUNT = 9;
const REAL_TURBO_TEST_TIMEOUT_MS = TURBO_EXECUTION_TIMEOUT_MS * TURBO_CACHE_SCENARIO_COUNT;

describe("Turbo cache contract", () => {
  let result: TurboCacheContractResult;

  beforeAll(() => {
    result = runTurboCacheContract();
  }, REAL_TURBO_TEST_TIMEOUT_MS);

  function scenario(name: string) {
    const found = result.scenarios.find((candidate) => candidate.name === name);
    expect(found, `missing scenario ${name}`).toBeDefined();
    return found;
  }

  function taskStatus(scenarioName: string, taskId: string) {
    return scenario(scenarioName)?.tasks.find((task) => task.taskId === taskId)?.status;
  }

  function expectPackageStatuses(
    scenarioName: string,
    packageName: "app" | "dependency",
    expected: { build: "HIT" | "MISS"; test: "HIT" | "MISS" },
  ) {
    expect(taskStatus(scenarioName, `@fixture/${packageName}#build`)).toBe(expected.build);
    expect(taskStatus(scenarioName, `@fixture/${packageName}#test`)).toBe(expected.test);
  }

  it("starts with cold build and test tasks", () => {
    expect(scenario("initial-run")).toMatchObject({
      taskCount: 4,
      hitCount: 0,
      missCount: 4,
    });
  });

  it("reuses every selected build and test task on an identical second run", () => {
    expect(scenario("identical-second-run")).toMatchObject({
      taskCount: 4,
      hitCount: 4,
      missCount: 0,
    });
  });

  it("invalidates the application build and test after a package source mutation", () => {
    expectPackageStatuses("package-source-mutation", "app", { build: "MISS", test: "MISS" });
  });

  it.each([["package-test-mutation"], ["package-config-mutation"]])(
    "preserves the application build and invalidates its test after %s",
    (scenarioName) => {
      expectPackageStatuses(scenarioName, "app", { build: "HIT", test: "MISS" });
    },
  );

  it.each([["declared-env-mutation"], ["lockfile-mutation"]])(
    "invalidates every selected build and test task after %s",
    (scenarioName) => {
      expect(scenario(scenarioName)).toMatchObject({ taskCount: 4, hitCount: 0, missCount: 4 });
    },
  );

  it("does not invalidate dependency tasks after an application-local mutation", () => {
    for (const scenarioName of [
      "package-source-mutation",
      "package-test-mutation",
      "package-config-mutation",
    ]) {
      expectPackageStatuses(scenarioName, "dependency", { build: "HIT", test: "HIT" });
    }
  });

  it("misses dependency and application build and test tasks after a direct dependency mutation", () => {
    expect(scenario("direct-dependency-mutation")).toMatchObject({
      taskCount: 4,
      hitCount: 0,
      missCount: 4,
    });
  });

  it("preserves selected build and test reuse after an unrelated package mutation", () => {
    expect(scenario("unrelated-package-mutation")).toMatchObject({
      taskCount: 4,
      hitCount: 4,
      missCount: 0,
    });
  });

  it("reports stable scenario diagnostics when an expected task is missing", () => {
    expect(() =>
      assertTurboCacheContract({
        scenarios: result.scenarios.map((candidate) =>
          candidate.name === "identical-second-run"
            ? {
                ...candidate,
                tasks: candidate.tasks.filter(({ taskId }) => taskId !== "@fixture/app#build"),
              }
            : candidate,
        ),
      }),
    ).toThrow(
      "[turbo-cache-contract] scenario identical-second-run: expected @fixture/app#build=HIT, observed <missing>",
    );
  });

  it("captures subprocess output context when Turbo execution fails", () => {
    const root = mkdtempSync(join(tmpdir(), "croco-failing-turbo-"));
    const turboBinary = join(root, "turbo");
    writeFileSync(
      turboBinary,
      "#!/usr/bin/env node\nprocess.stdout.write('captured stdout\\n');\nprocess.stderr.write('captured stderr\\n');\nprocess.exit(2);\n",
    );
    chmodSync(turboBinary, 0o755);
    try {
      expect(() => runTurboCacheContract({ turboBinary })).toThrow(
        /scenario initial-run: turbo execution failed\ncommand=.*\nstdout=captured stdout\nstderr=captured stderr\ncause=/,
      );
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("bounds each Turbo subprocess to ten minutes", () => {
    expect(TURBO_EXECUTION_TIMEOUT_MS).toBe(600_000);
  });
});
