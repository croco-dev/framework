import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { readTestInventory } from "../test-inventory.mts";

type TurboTask = {
  readonly cache?: boolean;
  readonly dependsOn?: readonly string[];
  readonly env?: readonly string[];
  readonly inputs?: readonly string[];
  readonly outputs?: readonly string[];
};

type TurboConfiguration = {
  readonly globalPassThroughEnv?: readonly string[];
  readonly tasks: Readonly<Record<string, TurboTask>>;
};

const repositoryRoot = resolve(__dirname, "../..");
const turbo = JSON.parse(
  readFileSync(resolve(repositoryRoot, "turbo.json"), "utf-8"),
) as TurboConfiguration;

describe("Turbo task contract", () => {
  it("hashes the worker limit for normal and executable-evidence test tasks", () => {
    for (const owner of ["", "@croco/docs#", "@croco/oxlint-rules#"]) {
      for (const command of ["test", "test:evidence"]) {
        const task = `${owner}${command}`;
        expect(turbo.tasks[task]?.env, task).toContain("VITEST_MAX_WORKERS");
      }
    }
    expect(turbo.globalPassThroughEnv).not.toContain("VITEST_MAX_WORKERS");
  });

  it("keeps test evidence options out of Turbo passthrough arguments", () => {
    expect(turbo.tasks["test:evidence"]).toEqual(turbo.tasks.test);
    expect(turbo.tasks["test:evidence"]?.inputs).toBeUndefined();
    for (const owner of ["@croco/docs", "@croco/oxlint-rules"]) {
      expect(turbo.tasks[`${owner}#test:evidence`]).toEqual(turbo.tasks[`${owner}#test`]);
    }
  });

  it("derives evidence scripts from every workspace test without duplicating test selection", () => {
    const expectedScript =
      "pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json";
    const evidenceWorkspaces = new Set<string>();
    for (const parent of ["packages", "examples"]) {
      for (const directory of readdirSync(resolve(repositoryRoot, parent), {
        withFileTypes: true,
      })) {
        if (!directory.isDirectory()) continue;
        const workspace = `${parent}/${directory.name}`;
        const manifestPath = resolve(repositoryRoot, workspace, "package.json");
        if (!existsSync(manifestPath)) continue;
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
          scripts?: Record<string, string>;
        };
        if (manifest.scripts?.test === undefined) {
          expect(manifest.scripts?.["test:evidence"], workspace).toBeUndefined();
          continue;
        }
        expect(manifest.scripts.test, workspace).toMatch(/(?:^|\s)vitest run(?:\s|$)/);
        expect(manifest.scripts["test:evidence"], workspace).toBe(expectedScript);
        evidenceWorkspaces.add(workspace);
      }
    }
    const { inventory, diagnostics } = readTestInventory(
      resolve(repositoryRoot, "test-inventory.json"),
    );
    expect(diagnostics).toEqual([]);
    const fastWorkspaces = new Set(
      inventory.tests
        .filter(({ lane, path }) => lane === "fast" && /^(packages|examples)\//.test(path))
        .map(({ path }) => path.split("/").slice(0, 2).join("/")),
    );
    expect([...evidenceWorkspaces].sort()).toEqual([...fastWorkspaces].sort());
  });

  it("forwards the explicit executable-evidence destination to test reporters", () => {
    expect(turbo.globalPassThroughEnv).toContain("CROCO_TEST_EVIDENCE_DIR");
  });

  it("runs lint without package-topology dependencies and hashes shared lint sources", () => {
    expect(turbo.tasks.lint?.dependsOn).toBeUndefined();
    expect(turbo.tasks.lint?.inputs).toEqual([
      "$TURBO_DEFAULT$",
      "$TURBO_ROOT$/.oxlintrc.json",
      "$TURBO_ROOT$/packages/oxlint-rules/src/**",
    ]);
  });

  it("keeps build and typecheck ordered by package topology", () => {
    expect(turbo.tasks.build?.dependsOn).toEqual(["^build"]);
    expect(turbo.tasks.typecheck?.dependsOn).toEqual(["build", "^build", "^typecheck"]);
  });

  it("caches API documentation models at package boundaries", () => {
    expect(turbo.tasks["docs:api:model"]).toEqual({
      cache: true,
      dependsOn: ["^docs:api:model"],
      inputs: [
        "src/**",
        "!src/tests/**",
        "!src/**/*.spec.*",
        "package.json",
        "$TURBO_ROOT$/packages/docs/api-docs.config.mjs",
        "$TURBO_ROOT$/packages/docs/scripts/generate-package-api-model.mts",
        "$TURBO_ROOT$/packages/docs/scripts/typedoc-merge-normalizer.mjs",
      ],
      outputs: [".turbo/docs-api/model.json"],
    });
  });

  it("prepares package API models before the docs development server starts", () => {
    expect(turbo.tasks["@croco/docs#dev"]).toEqual({
      cache: false,
      dependsOn: ["^docs:api:model"],
      persistent: true,
    });
    expect(turbo.tasks["docs:dev"]?.dependsOn).toEqual(["^docs:api:model"]);
  });

  it("caches formatter-ready drift candidates independently from tracked API Markdown", () => {
    expect(turbo.tasks["docs:api:render"]).toEqual({
      cache: true,
      dependsOn: ["^docs:api:model"],
      env: ["NODE_ENV"],
      inputs: [
        "api-docs.config.mjs",
        "astro.config.mjs",
        "package.json",
        "src/content.config.ts",
        "scripts/build-docs.mts",
        "scripts/prepare-api-models.mjs",
        "scripts/sanitize-typedoc-index.mjs",
        "$TURBO_ROOT$/.oxfmtrc.json",
      ],
      outputs: [".turbo/docs-api/rendered/**"],
    });
  });

  it("renders docs from package models without hashing tracked generated API Markdown", () => {
    expect(turbo.tasks["@croco/docs#build"]).toMatchObject({
      dependsOn: ["^docs:api:model"],
      inputs: ["$TURBO_DEFAULT$", "!src/content/docs/api/**"],
      outputs: ["dist/**"],
    });
    expect(turbo.tasks["@croco/docs#docs:build"]).toEqual({
      cache: true,
      dependsOn: ["^docs:api:model"],
      env: ["NODE_ENV"],
      inputs: ["$TURBO_DEFAULT$", "!src/content/docs/api/**"],
      outputs: ["dist/**"],
    });
  });

  it("keeps package task overrides independent from the removed lint edge", () => {
    expect(turbo.tasks["@croco/docs#test"]?.dependsOn).toEqual(["^build"]);
    expect(turbo.tasks["@croco/docs#test"]?.outputs).toEqual([".turbo/croco-test-evidence.json"]);
    expect(turbo.tasks["@croco/docs#typecheck"]?.dependsOn).toEqual(["^build", "^typecheck"]);
    expect(turbo.tasks["@croco/oxlint-rules#test"]?.dependsOn).toBeUndefined();
    expect(turbo.tasks["@croco/oxlint-rules#test"]?.outputs).toEqual([
      ".turbo/croco-test-evidence.json",
    ]);
  });
});

describe("Turbo compiler configuration cache inputs", () => {
  it("invalidates build and typecheck for inherited and local configs while reusing identical inputs", () => {
    const root = mkdtempSync(resolve(tmpdir(), "croco-tsconfig-cache-"));
    const write = (path: string, value: unknown) =>
      writeFileSync(resolve(root, path), JSON.stringify(value));
    try {
      mkdirSync(resolve(root, "packages/app"), { recursive: true });
      cpSync(resolve(repositoryRoot, "tsconfig"), resolve(root, "tsconfig"), { recursive: true });
      cpSync(resolve(repositoryRoot, "turbo.json"), resolve(root, "turbo.json"));
      write("package.json", {
        name: "compiler-cache-fixture",
        private: true,
        packageManager: "pnpm@10.15.0",
      });
      writeFileSync(resolve(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(
        resolve(root, "pnpm-lock.yaml"),
        "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  packages/app: {}\n",
      );
      writeFileSync(resolve(root, ".gitignore"), ".turbo\n**/dist\nexecutions.log\n");
      write("packages/app/package.json", {
        name: "@fixture/app",
        private: true,
        scripts: { build: "node runner.mjs build", typecheck: "node runner.mjs typecheck" },
      });
      write("packages/app/tsconfig.json", { extends: "../../tsconfig/tsconfig.node.json" });
      writeFileSync(
        resolve(root, "packages/app/runner.mjs"),
        "import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';\n" +
          "appendFileSync('../../executions.log', process.argv[2] + '\\n');\n" +
          "mkdirSync('dist', { recursive: true }); writeFileSync('dist/result.txt', 'built');\n",
      );
      execFileSync("git", ["init", "--quiet"], { cwd: root });
      execFileSync("git", ["add", "."], { cwd: root });
      const run = () => {
        const previous = new Set(
          existsSync(resolve(root, ".turbo/runs")) ? readdirSync(resolve(root, ".turbo/runs")) : [],
        );
        execFileSync(
          resolve(repositoryRoot, "node_modules/.bin/turbo"),
          [
            "run",
            "build",
            "typecheck",
            "--filter=@fixture/app",
            "--cache=local:rw",
            "--cache-dir=.turbo/cache",
            "--summarize",
            "--no-daemon",
          ],
          {
            cwd: root,
            encoding: "utf8",
            timeout: 60_000,
            stdio: "pipe",
            env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1" },
          },
        );
        const runs = readdirSync(resolve(root, ".turbo/runs")).filter(
          (file) => !previous.has(file),
        );
        expect(runs).toHaveLength(1);
        return JSON.parse(readFileSync(resolve(root, ".turbo/runs", runs[0]), "utf8")) as {
          tasks: { taskId: string; hash: string; cache: { status: string } }[];
        };
      };
      const executions = () => readFileSync(resolve(root, "executions.log"), "utf8");
      const baseline = run();
      expect(baseline.tasks.map((task) => task.taskId).sort()).toEqual([
        "@fixture/app#build",
        "@fixture/app#typecheck",
      ]);
      expect(baseline.tasks.map((task) => task.cache.status)).toEqual(["MISS", "MISS"]);
      const coldExecutions = executions();
      expect(coldExecutions.trim().split("\n").sort()).toEqual(["build", "typecheck"]);
      const reused = run();
      expect(reused.tasks.map((task) => task.hash)).toEqual(
        baseline.tasks.map((task) => task.hash),
      );
      expect(reused.tasks.map((task) => task.cache.status)).toEqual(["HIT", "HIT"]);
      expect(executions()).toBe(coldExecutions);
      for (const [path, option, value] of [
        ["tsconfig/tsconfig.base.json", "strict", false],
        ["tsconfig/tsconfig.node.json", "target", "es2022"],
        ["packages/app/tsconfig.json", "experimentalDecorators", false],
      ] as const) {
        const original = readFileSync(resolve(root, path), "utf8");
        const config = JSON.parse(original);
        config.compilerOptions = { ...config.compilerOptions, [option]: value };
        write(path, config);
        const before = executions();
        const changed = run();
        for (const task of changed.tasks) {
          expect(task.hash, `${path}: ${task.taskId}`).not.toBe(
            baseline.tasks.find((old) => old.taskId === task.taskId)?.hash,
          );
          expect(task.cache.status, `${path}: ${task.taskId}`).toBe("MISS");
        }
        expect(executions().slice(before.length).trim().split("\n").sort(), path).toEqual([
          "build",
          "typecheck",
        ]);
        const after = executions();
        expect(
          run().tasks.map((task) => task.cache.status),
          path,
        ).toEqual(["HIT", "HIT"]);
        expect(executions(), path).toBe(after);
        writeFileSync(resolve(root, path), original);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);
});
