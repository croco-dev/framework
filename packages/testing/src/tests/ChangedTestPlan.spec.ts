import { describe, expect, it } from "vitest";

import {
  assertChangedTestSelectionBaseline,
  assertChangedTestPlanEnforceable,
  createChangedTestPlan,
  createExecutableAssuranceGraph,
  createTestEvidenceBundle,
  createTestEvidenceRecord,
  updateChangedTestSelectionBaseline,
  type ExecutableAssuranceGraph,
  type TestEvidenceRecord,
} from "../index";

function graph(responseType: string): ExecutableAssuranceGraph {
  const value = createExecutableAssuranceGraph({
    contractGraph: {
      snapshotVersion: "croco.contract-graph.snapshot.v1",
      graphVersion: "croco.contract-graph.v1",
      controllerCount: 1,
      routeCount: 1,
      operationIds: ["createUser"],
      controllers: [
        {
          name: "UsersController",
          path: "/users",
          guards: [],
          roles: [],
          routeIds: ["UsersController.create"],
        },
      ],
      routes: [
        {
          routeId: "UsersController.create",
          operationId: "createUser",
          controllerName: "UsersController",
          methodName: "create",
          httpMethod: "POST",
          path: "/users",
          controllerPath: "/users",
          domain: "users",
          routeContract: {
            id: "users.create",
            method: "POST",
            path: "/users",
            sourceLocation: { path: "src/UsersController.ts", line: 12 },
          },
          access: { guards: [], roles: [] },
          entitlements: [],
          params: [],
          request: { body: null, path: null, query: null, headers: null },
          response: {
            kind: responseType,
            typeName: responseType === "string" ? "ZodString" : "ZodNumber",
            jsonSafe: true,
          },
          problems: [{ code: "USER_EMAIL_CONFLICT", category: "Conflict", status: 409 }],
        },
      ],
      diagnostics: [],
    },
  });
  return value;
}

function problemGraph(includeProblem: boolean): ExecutableAssuranceGraph {
  return createExecutableAssuranceGraph({
    problemRegistry: {
      version: "croco.problem-code-registry.v1",
      problemCount: includeProblem ? 1 : 0,
      problems: includeProblem
        ? [
            {
              code: "USER_EMAIL_CONFLICT",
              category: "Conflict",
              status: 409,
              title: "Conflict",
              cookbookPath: "/reference/problems/#user-email-conflict",
              recovery: {
                cause: "The email is already used.",
                userAction: "Use another email.",
                operatorAction: "Inspect the existing account.",
                retryability: "not-retryable",
                redactionPolicy: "public",
                telemetry: {
                  eventName: "problem.user_email_conflict",
                  severity: "warning",
                  attributes: [],
                },
              },
              lifecycle: { status: "active" },
              sources: [
                {
                  file: "src/UserEmailConflictProblem.ts",
                  line: 3,
                  column: 1,
                  kind: "problem-class",
                },
              ],
            },
          ]
        : [],
    },
  });
}

function eventGraph(eventName: string): ExecutableAssuranceGraph {
  return createExecutableAssuranceGraph({
    frameworkManifest: {
      version: "croco.framework-manifest.v1",
      schema: {
        entityVocabulary: [],
        sourceLocationFields: ["path", "line", "column"],
        consumerApis: [],
      },
      summary: {
        sourceFiles: 1,
        entities: 1,
        controllers: 0,
        routes: 0,
        providers: 0,
        eventHandlers: 0,
        domainEvents: 1,
        relationships: 0,
      },
      generatedArtifacts: [],
      sourceFiles: [],
      entities: [
        {
          kind: "domain.event",
          id: "UserEvent",
          name: "UserEvent",
          eventName,
          source: { path: "src/UserEvent.ts", line: 3, column: 1 },
        },
      ],
      relationships: [],
      diagnostics: [],
    },
  });
}

function evidence(
  id: string,
  contractId: string,
  outcome: "passed" | "failed" = "passed",
  packageName?: string,
): TestEvidenceRecord {
  const routeId = contractId.startsWith("route:") ? contractId.slice("route:".length) : undefined;
  return createTestEvidenceRecord({
    id,
    runner: "vitest",
    ...(packageName ? { packageName } : {}),
    intent: { contractIds: [contractId], description: id },
    observed: {
      contractIds: [`${contractId}#response`],
      ...(routeId ? { routeIds: [routeId] } : {}),
    },
    fidelity: {
      boot: "application",
      dependency: "local-real",
      isolation: "commit",
      runtime: "node",
      validation: "production",
    },
    replay: { command: `pnpm vitest run -t "${id}"` },
    attempts: [{ attempt: 1, outcome }],
    resources: { leaks: [], status: "clean" },
    timing: { durationMs: 800 },
  });
}

function completeFullEvidence(records: readonly TestEvidenceRecord[]) {
  return createTestEvidenceBundle([
    ...records,
    evidence("croco.changed-test-full-suite-status", "verification:full-suite"),
  ]);
}

describe("ChangedTestPlan", () => {
  it("validates durable baseline artifacts before they are reused", () => {
    expect(() =>
      assertChangedTestSelectionBaseline({
        schemaVersion: "croco.changed-test-selection-baseline/v1",
        observationWindow: 2,
        missThreshold: 0,
        observedRuns: 0,
        selectionMisses: 0,
        missRate: 0,
        eligibleForEnforcement: false,
        runs: [],
      }),
    ).not.toThrow();
    expect(() =>
      assertChangedTestSelectionBaseline({
        schemaVersion: "croco.changed-test-selection-baseline/v1",
        observationWindow: 1,
        missThreshold: 0,
        observedRuns: 0,
        selectionMisses: 0,
        missRate: 2,
        eligibleForEnforcement: false,
        runs: [],
      }),
    ).toThrow("CROCO_CHANGED_TEST_PLAN_INVALID");
  });

  it("widens a route schema change while retaining its contract and source evidence", () => {
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: graph("string"),
      headGraph: graph("number"),
      evidence: createTestEvidenceBundle([
        evidence("users.create.success", "route:UsersController.create"),
        evidence("orders.list.success", "route:OrdersController.list"),
      ]),
      changedFiles: ["packages/users/src/UsersController.ts"],
      budgetMs: 500,
    });

    expect(plan).toMatchObject({
      schemaVersion: "croco.changed-test-plan/v1",
      mode: "shadow",
      changedContracts: ["route:UsersController.create"],
      selectedTests: ["orders.list.success", "users.create.success"],
      selectedSuites: [expect.objectContaining({ profile: "full" })],
      requiredEvidence: [
        "route:UsersController.create",
        "route:UsersController.create#problem:USER_EMAIL_CONFLICT",
      ],
      incomplete: true,
      budget: { estimatedMs: 1600, limitMs: 500, overflowMs: 1100 },
    });
    expect(plan.commands).toEqual([["pnpm", "test"]]);
    expect(plan.selectionReasons[0]?.reason).toContain("widened the plan to the full profile");
    expect(plan.selectionReasons[0]?.command).toEqual([
      "sh",
      "-c",
      'pnpm vitest run -t "orders.list.success"',
    ]);
    expect(plan.excludedTests).toEqual([]);
    expect(plan.sourceLocations).toEqual([
      {
        contractId: "route:UsersController.create",
        path: "src/UsersController.ts",
        line: 12,
      },
    ]);
  });

  it("widens unsupported and test-infrastructure changes to the full profile", () => {
    const bundle = createTestEvidenceBundle([
      evidence("users.create.success", "route:UsersController.create"),
      evidence("orders.list.success", "route:OrdersController.list"),
    ]);
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: graph("string"),
      headGraph: graph("string"),
      evidence: bundle,
      changedFiles: ["packages/testing/src/index.ts", "unknown.config"],
    });

    expect(plan.selectedTests).toEqual(["orders.list.success", "users.create.success"]);
    expect(plan.commands).toContainEqual(["pnpm", "test"]);
    expect(plan.fallbacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ profile: "full" }),
        expect.objectContaining({ paths: ["unknown.config"] }),
      ]),
    );
  });

  it("widens shared runtime boundary changes to the full profile", () => {
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: graph("string"),
      headGraph: graph("string"),
      evidence: createTestEvidenceBundle([
        evidence("users.create.success", "route:UsersController.create"),
      ]),
      changedFiles: ["packages/problems-core/src/Problem.ts"],
    });

    expect(plan.commands).toContainEqual(["pnpm", "test"]);
    expect(plan.fallbacks).toContainEqual(
      expect.objectContaining({
        profile: "full",
        paths: ["packages/problems-core/src/Problem.ts"],
      }),
    );
  });

  it("selects evidence for a newly declared Problem", () => {
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: problemGraph(false),
      headGraph: problemGraph(true),
      evidence: createTestEvidenceBundle([
        evidence("users.email-conflict", "problem:USER_EMAIL_CONFLICT"),
      ]),
      changedFiles: ["packages/users/src/UserEmailConflictProblem.ts"],
    });

    expect(plan.changedContracts).toEqual(["problem:USER_EMAIL_CONFLICT"]);
    expect(plan.selectedTests).toEqual(["users.email-conflict"]);
    expect(plan.selectionReasons[0]?.contractId).toBe("fallback:full");
  });

  it("selects evidence when a domain event artifact changes", () => {
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: eventGraph("user.created"),
      headGraph: eventGraph("user.renamed"),
      evidence: createTestEvidenceBundle([evidence("users.renamed-event", "event:user.renamed")]),
      changedFiles: ["packages/users/src/UserEvent.ts"],
    });

    expect(plan.changedContracts).toEqual(["event:user.created", "event:user.renamed"]);
    expect(plan.selectedTests).toEqual(["users.renamed-event"]);
  });

  it("widens frontend-only changes when dependent package coverage cannot be proven", () => {
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: graph("string"),
      headGraph: graph("string"),
      evidence: createTestEvidenceBundle([
        evidence("users.create.success", "route:UsersController.create"),
      ]),
      changedFiles: ["apps/console-web/src/App.tsx"],
    });

    expect(plan.changedContracts).toEqual([]);
    expect(plan.selectedSuites).toEqual([expect.objectContaining({ profile: "full" })]);
    expect(plan.excludedTests).toEqual([]);
  });

  it("runs the full suite for an ordinary package change so dependent packages cannot be omitted", () => {
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: graph("string"),
      headGraph: graph("string"),
      evidence: createTestEvidenceBundle([
        evidence("users.package-suite", "route:UsersController.read", "passed", "@croco/users"),
        evidence(
          "orders.dependent-suite",
          "route:OrdersController.read",
          "passed",
          "@croco/orders",
        ),
      ]),
      changedFiles: ["packages/users/src/UserService.ts"],
    });

    expect(plan.fallbacks).toEqual([
      expect.objectContaining({
        profile: "full",
        paths: ["packages/users/src/UserService.ts"],
        reason: expect.stringContaining("dependent package coverage cannot be proven"),
      }),
    ]);
    expect(plan.selectedSuites).toEqual([
      expect.objectContaining({ profile: "full", command: ["pnpm", "test"] }),
    ]);
    expect(plan.excludedTests).toEqual([]);
  });

  it("widens package-scoped build configuration changes without duplicate fallback reasons", () => {
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: graph("string"),
      headGraph: graph("string"),
      changedFiles: ["packages/users/package.json"],
    });

    expect(plan.fallbacks).toEqual([
      expect.objectContaining({ profile: "full", paths: ["packages/users/package.json"] }),
    ]);
  });

  it("keeps missing durations informational when no budget is configured", () => {
    const untimed = createTestEvidenceRecord({
      id: "users.untimed",
      runner: "vitest",
      intent: { contractIds: [], description: "untimed" },
      observed: { contractIds: [] },
      fidelity: {
        boot: "isolated",
        dependency: "fake",
        isolation: "fake",
        runtime: "node",
        validation: "isolated",
      },
      replay: { command: "pnpm vitest run -t users.untimed" },
      attempts: [{ attempt: 1, outcome: "passed" }],
      resources: { leaks: [], status: "clean" },
    });
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: graph("string"),
      headGraph: graph("string"),
      evidence: createTestEvidenceBundle([untimed]),
      changedFiles: ["packages/testing/src/index.ts"],
    });

    expect(plan.budget.unknownDurationTests).toEqual(["users.untimed"]);
    expect(plan.incomplete).toBe(false);
  });

  it("tracks project DI and generated-client artifact content changes", () => {
    const projectGraph = (
      dependency: string,
      commitPolicy: "commit-required" | "gitignored-generated",
    ) =>
      createExecutableAssuranceGraph({
        projectMap: {
          version: "croco.project-map.manifest.v1",
          routeGraph: { routes: [] },
          problems: { responses: [] },
          di: {
            providers: [
              {
                id: "UserService",
                name: "UserService",
                scope: "request",
                dependencies: [dependency],
                source: { file: "src/UserService.ts", line: 8 },
              },
            ],
          },
          generatedArtifacts: [{ kind: "rpc-client", path: "src/generated/rpc.ts", commitPolicy }],
        },
      });
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: projectGraph("UserRepository", "commit-required"),
      headGraph: projectGraph("CachedUserRepository", "gitignored-generated"),
      evidence: createTestEvidenceBundle([
        evidence("di.user-service", "di-provider:UserService"),
        evidence("rpc.generated-client", "generated-client:rpc-client:src/generated/rpc.ts"),
      ]),
      changedFiles: ["packages/users/src/UserService.ts"],
    });

    expect(plan.changedContracts).toEqual([
      "di-provider:UserService",
      "generated-client:rpc-client:src/generated/rpc.ts",
    ]);
    expect(plan.selectedTests).toEqual(["di.user-service", "rpc.generated-client"]);
    expect(plan.sourceLocations).toContainEqual({
      contractId: "di-provider:UserService",
      path: "src/UserService.ts",
      line: 8,
    });
  });

  it("records omitted full-suite failures as advisory selection misses", () => {
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: graph("string"),
      headGraph: graph("number"),
      evidence: createTestEvidenceBundle([
        evidence("users.create.success", "route:UsersController.create"),
      ]),
      changedFiles: ["docs/users-controller.md"],
    });
    const fullEvidence = completeFullEvidence([
      evidence("users.create.success", "route:UsersController.create"),
      evidence("hidden.regression", "route:HiddenController.read", "failed"),
    ]);
    const baseline = updateChangedTestSelectionBaseline(plan, fullEvidence, {
      observationWindow: 2,
      missThreshold: 0,
    });

    expect(baseline).toMatchObject({
      observedRuns: 0,
      selectionMisses: 1,
      eligibleForEnforcement: false,
      runs: [{ missedTests: ["hidden.regression"] }],
    });
    expect(() => assertChangedTestPlanEnforceable(baseline)).toThrow(
      "Enforcement requires 2 observed run(s)",
    );
  });

  it("does not count dependent failures as misses when package changes select the full suite", () => {
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: graph("string"),
      headGraph: graph("string"),
      evidence: createTestEvidenceBundle([]),
      changedFiles: ["packages/users/src/UserService.ts"],
    });
    const baseline = updateChangedTestSelectionBaseline(
      plan,
      completeFullEvidence([
        evidence("users.hidden", "route:HiddenController.read", "failed", "@croco/users"),
      ]),
      { observationWindow: 2, missThreshold: 0 },
    );

    expect(plan.selectedSuites).toEqual([
      expect.objectContaining({ profile: "full", command: ["pnpm", "test"] }),
    ]);
    expect(baseline.runs[0]?.missedTests).toEqual([]);
  });

  it("does not report failures as misses when the selected plan covers the full suite", () => {
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: graph("string"),
      headGraph: graph("string"),
      evidence: createTestEvidenceBundle([]),
      changedFiles: ["packages/testing/src/index.ts"],
    });
    const baseline = updateChangedTestSelectionBaseline(
      plan,
      completeFullEvidence([
        evidence("hidden.regression", "route:HiddenController.read", "failed"),
      ]),
      { observationWindow: 2, missThreshold: 0 },
    );

    expect(plan.selectedSuites).toEqual([
      expect.objectContaining({ profile: "full", command: ["pnpm", "test"] }),
    ]);
    expect(baseline.runs[0]?.missedTests).toEqual([]);
  });

  it("does not count empty full evidence toward the enforcement observation window", () => {
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: graph("string"),
      headGraph: graph("number"),
      evidence: createTestEvidenceBundle([]),
      changedFiles: ["packages/users/src/UsersController.ts"],
    });
    const baseline = updateChangedTestSelectionBaseline(plan, createTestEvidenceBundle([]), {
      observationWindow: 1,
      missThreshold: 0,
    });

    expect(baseline).toMatchObject({ observedRuns: 0, eligibleForEnforcement: false });
    expect(baseline.runs[0]).toMatchObject({ complete: false, fullTests: 0 });
    expect(() => assertChangedTestPlanEnforceable(baseline)).toThrow("only 0 are recorded");
  });

  it("enables enforcement only after the documented window and threshold are satisfied", () => {
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: graph("string"),
      headGraph: graph("number"),
      evidence: createTestEvidenceBundle([
        evidence("users.create.success", "route:UsersController.create"),
      ]),
      changedFiles: ["packages/users/src/UsersController.ts"],
    });
    const fullEvidence = completeFullEvidence([
      evidence("users.create.success", "route:UsersController.create"),
    ]);
    const first = updateChangedTestSelectionBaseline(plan, fullEvidence, {
      observationWindow: 2,
      missThreshold: 0,
    });
    const second = updateChangedTestSelectionBaseline(plan, fullEvidence, {
      previous: first,
      observationWindow: 2,
      missThreshold: 0,
    });

    expect(second.eligibleForEnforcement).toBe(true);
    expect(() => assertChangedTestPlanEnforceable(second)).not.toThrow();
  });

  it("requires the retained run window even when cumulative observed runs are larger", () => {
    const plan = createChangedTestPlan({
      base: "origin/trunk",
      baseGraph: graph("string"),
      headGraph: graph("number"),
      changedFiles: ["packages/users/src/UsersController.ts"],
    });
    const baseline = updateChangedTestSelectionBaseline(
      plan,
      completeFullEvidence([evidence("users.create.success", "route:UsersController.create")]),
      {
        previous: {
          schemaVersion: "croco.changed-test-selection-baseline/v1",
          observationWindow: 2,
          missThreshold: 0,
          observedRuns: 10,
          selectionMisses: 0,
          missRate: 0,
          eligibleForEnforcement: true,
          runs: [],
        },
        observationWindow: 2,
        missThreshold: 0,
      },
    );

    expect(baseline.observedRuns).toBe(11);
    expect(baseline.runs).toHaveLength(1);
    expect(baseline.eligibleForEnforcement).toBe(false);
  });
});
