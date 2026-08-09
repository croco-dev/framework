import { describe, expect, it } from "vitest";

import {
  ChangedTestPlanProblem,
  createExecutableAssuranceGraph,
  createTestEvidenceBundle,
  createTestEvidenceRecord,
  serializeExecutableAssurance,
  serializeTestEvidence,
} from "@croco/testing/executable-assurance";

import { parseTestPlanArgs, runTestPlan } from "../commands/testPlan.js";

describe("test plan", () => {
  it("derives a machine-readable changed test plan from Git base/head artifacts", () => {
    const writes = new Map<string, string>();
    const stdout: string[] = [];
    const baseGraph = serializeExecutableAssurance(graph("GET /users"));
    const headGraph = serializeExecutableAssurance(graph("POST /users"));
    const evidence = serializeTestEvidence(
      createTestEvidenceBundle([testEvidence("users.create.success")]),
    );
    const files = new Map([
      ["/workspace/executable-assurance.graph.json", headGraph],
      ["/workspace/ci-reports/test-evidence/bundle.json", evidence],
    ]);

    const exitCode = runTestPlan(
      ["--changed", "origin/trunk", "--out", "ci-reports/changed-test-plan/plan.json"],
      {
        cwd: "/workspace",
        exists: (path) => files.has(path),
        readFile: (path) => files.get(path) ?? "",
        mkdir: () => {},
        writeFile: (path, content) => writes.set(path, content),
        stdout: (message) => stdout.push(message),
        git: (args) => {
          if (args[0] === "show") return baseGraph;
          if (args[0] === "diff") return "packages/users/src/UsersController.ts\n";
          if (args[0] === "rev-parse") return "abc123\n";
          throw new Error(`Unexpected git command: ${args.join(" ")}`);
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toEqual([
      "Wrote changed test plan artifact to /workspace/ci-reports/changed-test-plan/plan.json.",
    ]);
    expect(
      JSON.parse(writes.get("/workspace/ci-reports/changed-test-plan/plan.json") ?? "{}"),
    ).toMatchObject({
      base: "origin/trunk",
      head: "abc123",
      changedContracts: ["route:UsersController.create"],
      selectedTests: ["users.create.success"],
      fallbacks: [{ profile: "full" }],
    });
  });

  it("falls back to the full profile when graph history is unavailable", () => {
    const stdout: string[] = [];
    const exitCode = runTestPlan(["--changed", "origin/trunk"], {
      cwd: "/workspace",
      exists: () => false,
      stdout: (message) => stdout.push(message),
      git: (args) => {
        if (args[0] === "show") {
          throw new Error(
            "fatal: path 'executable-assurance.graph.json' does not exist in 'origin/trunk'",
          );
        }
        if (args[0] === "diff") return "unknown.config\n";
        return "abc123\n";
      },
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout[0] ?? "{}")).toMatchObject({
      commands: [["pnpm", "test"]],
      fallbacks: expect.arrayContaining([expect.objectContaining({ profile: "full" })]),
    });
  });

  it.each([
    ["an invalid revision", new Error("fatal: invalid object name 'missing-revision'")],
    ["a Git execution failure", new Error("spawn git EACCES")],
  ])("reports %s instead of treating the base graph as missing", (_label, gitError) => {
    expect(() =>
      runTestPlan(["--changed", "missing-revision"], {
        cwd: "/workspace",
        exists: () => false,
        git: (args) => {
          if (args[0] === "show") throw gitError;
          return "";
        },
      }),
    ).toThrow(/CROCO_CHANGED_TEST_PLAN_INVALID: Unable to read base assurance graph/);
  });

  it.each([
    ["malformed JSON", "{"],
    ["an invalid schema", "{}"],
  ])("reports a base graph with %s", (_label, baseGraph) => {
    expect(() =>
      runTestPlan(["--changed", "origin/trunk"], {
        cwd: "/workspace",
        exists: () => false,
        git: (args) => {
          if (args[0] === "show") return baseGraph;
          return "";
        },
      }),
    ).toThrow(ChangedTestPlanProblem);
  });

  it("preserves a malformed base graph parse failure as the problem cause", () => {
    try {
      runTestPlan(["--changed", "origin/trunk"], {
        cwd: "/workspace",
        exists: () => false,
        git: () => "{",
      });
      throw new Error("Expected changed-test planning to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ChangedTestPlanProblem);
      expect((error as ChangedTestPlanProblem).cause).toBeInstanceOf(SyntaxError);
    }
  });

  it("preserves the Git failure as the changed-test problem cause", () => {
    const gitError = new Error("spawn git EACCES");

    expect(() =>
      runTestPlan(["--changed", "origin/trunk"], {
        cwd: "/workspace",
        exists: () => false,
        git: () => {
          throw gitError;
        },
      }),
    ).toThrow(
      expect.objectContaining({
        cause: gitError,
        code: "CROCO_CHANGED_TEST_PLAN_INVALID",
      }),
    );
  });

  it.each(["diff", "rev-parse"])(
    "reports a %s failure with the Git command and original cause",
    (failedCommand) => {
      const gitError = new Error(`${failedCommand} failed`);

      expect(() =>
        runTestPlan(["--changed", "origin/trunk"], {
          cwd: "/workspace",
          exists: () => false,
          git: (args) => {
            if (args[0] === "show") {
              throw new Error(
                "fatal: path 'executable-assurance.graph.json' does not exist in 'origin/trunk'",
              );
            }
            if (args[0] === failedCommand) throw gitError;
            return "abc123\n";
          },
        }),
      ).toThrow(
        expect.objectContaining({
          cause: gitError,
          message: expect.stringContaining(`git ${failedCommand}`),
        }),
      );
    },
  );

  it("keeps shadow mode advisory and rejects premature enforcement", () => {
    const baseGraph = serializeExecutableAssurance(graph("GET /users"));
    const headGraph = serializeExecutableAssurance(graph("POST /users"));
    const selected = serializeTestEvidence(
      createTestEvidenceBundle([testEvidence("users.create.success")]),
    );
    const full = serializeTestEvidence(
      createTestEvidenceBundle([testEvidence("users.create.success")]),
    );
    const files = new Map([
      ["/workspace/executable-assurance.graph.json", headGraph],
      ["/workspace/ci-reports/test-evidence/bundle.json", selected],
      ["/workspace/full.json", full],
    ]);

    expect(() =>
      runTestPlan(
        [
          "--changed",
          "origin/trunk",
          "--full-evidence",
          "full.json",
          "--observation-window",
          "2",
          "--enforce",
        ],
        {
          cwd: "/workspace",
          exists: (path) => files.has(path),
          readFile: (path) => files.get(path) ?? "",
          mkdir: () => {},
          writeFile: () => {},
          stdout: () => {},
          git: (args) => {
            if (args[0] === "show") return baseGraph;
            if (args[0] === "diff") return "packages/users/src/UsersController.ts\n";
            return "abc123\n";
          },
        },
      ),
    ).toThrow("Enforcement requires 2 observed run(s)");
  });

  it("rejects an invalid persisted baseline before updating it", () => {
    const baseGraph = serializeExecutableAssurance(graph("GET /users"));
    const full = serializeTestEvidence(
      createTestEvidenceBundle([testEvidence("users.create.success")]),
    );
    const files = new Map([
      ["/workspace/full.json", full],
      ["/workspace/baseline.json", JSON.stringify({ observedRuns: "1", runs: [] })],
    ]);

    expect(() =>
      runTestPlan(
        [
          "--changed",
          "origin/trunk",
          "--full-evidence",
          "full.json",
          "--baseline",
          "baseline.json",
        ],
        {
          cwd: "/workspace",
          exists: (path) => files.has(path),
          readFile: (path) => files.get(path) ?? "",
          stdout: () => {},
          git: (args) => {
            if (args[0] === "show") return baseGraph;
            if (args[0] === "diff") return "packages/users/src/UsersController.ts\n";
            return "abc123\n";
          },
        },
      ),
    ).toThrow(/CROCO_CHANGED_TEST_PLAN_INVALID: Invalid changed-test baseline/);
  });

  it.each([
    "C:\\outside\\graph.json",
    "C:outside\\graph.json",
    "..\\outside\\graph.json",
    "\\\\server\\graph.json",
  ])("rejects unsafe Windows graph path %s", (graphPath) => {
    expect(() =>
      runTestPlan(["--changed", "origin/trunk", "--graph", graphPath], {
        cwd: "/workspace",
        exists: () => false,
      }),
    ).toThrow(/--graph must be a repository-relative path/);
  });

  it("requires the explicit changed base", () => {
    expect(parseTestPlanArgs([])).toEqual({
      kind: "invalid",
      message: "Missing base revision. Pass --changed <base>.",
    });
  });
});

function graph(label: string) {
  return createExecutableAssuranceGraph({
    projectMap: {
      version: "croco.project-map.manifest.v1",
      routeGraph: {
        routes: [
          {
            id: "UsersController.create",
            method: label.startsWith("GET") ? "GET" : "POST",
            path: "/users",
            source: { path: "src/UsersController.ts", line: 10 },
          },
        ],
      },
      problems: { responses: [] },
    },
  });
}

function testEvidence(id: string) {
  return createTestEvidenceRecord({
    id,
    runner: "vitest",
    intent: { contractIds: ["route:UsersController.create"], description: id },
    observed: {
      contractIds: ["route:UsersController.create#response"],
      routeIds: ["UsersController.create"],
    },
    fidelity: {
      boot: "application",
      dependency: "local-real",
      isolation: "commit",
      runtime: "node",
      validation: "production",
    },
    replay: { command: `pnpm vitest run -t "${id}"` },
    attempts: [{ attempt: 1, outcome: "passed" }],
    resources: { leaks: [], status: "clean" },
  });
}
