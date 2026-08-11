import { describe, expect, it } from "vitest";

import type { FrameworkManifest } from "@croco/framework-routes";
import type { ProblemCodeRegistry } from "@croco/problems-core";
import type { ContractGraphSnapshot } from "@croco/protocols-core";

import {
  assertExecutableAssuranceSatisfied,
  assertExecutableAssuranceGraph,
  createExecutableAssuranceGraph,
  createTestEvidenceBundle,
  createTestEvidenceRecord,
  evaluateExecutableAssuranceGraph,
  ExecutableAssuranceUnsatisfiedProblem,
  ExecutableAssuranceContractProblem,
  renderExecutableAssuranceMarkdown,
  serializeExecutableAssurance,
  type ExecutableAssuranceGraph,
  type TestEvidenceAttachment,
  type TestEvidenceFidelity,
  type TestEvidenceObservation,
  type TestEvidenceRecord,
} from "../index";

const applicationFidelity: TestEvidenceFidelity = {
  boot: "application",
  dependency: "local-real",
  isolation: "commit",
  runtime: "node",
  validation: "production",
};

function evidence(input: {
  id: string;
  intent: readonly string[];
  observed?: TestEvidenceObservation;
  fidelity?: TestEvidenceFidelity;
  outcome?: "passed" | "failed";
  attachments?: readonly TestEvidenceAttachment[];
}): TestEvidenceRecord {
  return createTestEvidenceRecord({
    id: input.id,
    runner: "vitest",
    intent: { contractIds: input.intent, description: input.id },
    observed: input.observed ?? { contractIds: [] },
    fidelity: input.fidelity ?? applicationFidelity,
    replay: { command: `pnpm test -- -t "${input.id}"` },
    resources: { leaks: [], status: "clean" },
    attachments: input.attachments,
    attempts: [{ attempt: 1, outcome: input.outcome ?? "passed" }],
  });
}

function createGraph(): ExecutableAssuranceGraph {
  return createExecutableAssuranceGraph({
    contractGraph: contractGraph(),
    problemRegistry: problemRegistry(),
    frameworkManifest: frameworkManifest(),
    projectMap: {
      version: "croco.project-map.manifest.v1",
      routeGraph: { routes: [] },
      problems: { responses: [] },
      packageGraph: {
        providerProfile: {
          profileName: "saas-node",
          packages: ["@croco/storage-s3"],
        },
      },
    },
    tasks: [{ name: "user.welcome", source: { path: "src/tasks/UserWelcome.ts", line: 7 } }],
    runtimeCapability: {
      version: "croco.runtime-capability.manifest.v1",
      platform: "node",
      capabilities: {
        env: true,
        filesystem: true,
        logger: true,
        nodeApi: true,
        requestLifecycle: true,
        trace: true,
        waitUntil: false,
        flush: true,
        streamingResponse: true,
        deadline: true,
        abortSignal: true,
        shutdown: true,
      },
      diagnostics: [],
    },
    providerConformance: {
      version: "croco.provider-conformance.manifest.v1",
      profiles: [
        {
          packageName: "@croco/storage-s3",
          providerName: "s3",
          category: "storage",
          capabilities: [
            {
              name: "upload",
              required: true,
              supported: true,
              methods: ["put"],
              suite: "storage-provider-conformance",
            },
          ],
        },
      ],
    },
    providerProfile: {
      schemaVersion: "croco.saas-provider-profile/v1",
      profile: { name: "saas-node" },
      packages: ["@croco/storage-s3"],
    },
    publicApi: { schemaVersion: 2, packages: [] },
    criticalJourneys: [
      {
        id: "user-signup",
        description: "A user signs up and the welcome work commits.",
        observations: [
          { field: "routeIds", id: "UsersController.create" },
          { field: "eventIds", id: "user.created" },
          { field: "spanIds", id: "user.signup" },
        ],
        minimumFidelity: {
          boot: "application",
          isolation: "commit",
          validation: "production",
        },
        replayCommand: 'pnpm test -- -t "user signup"',
        source: { path: "tests/journeys/user-signup.spec.ts", line: 12 },
      },
    ],
  });
}

function completeEvidence(): TestEvidenceRecord[] {
  return [
    evidence({
      id: "route-success",
      intent: ["route:UsersController.create"],
      observed: {
        contractIds: ["route:UsersController.create#response"],
        routeIds: ["UsersController.create"],
      },
    }),
    evidence({
      id: "route-problem",
      intent: [
        "problem:USER_EMAIL_CONFLICT",
        "route:UsersController.create#problem:USER_EMAIL_CONFLICT",
      ],
      observed: {
        contractIds: [],
        problemCodes: ["USER_EMAIL_CONFLICT"],
        routeIds: ["UsersController.create"],
      },
    }),
    evidence({
      id: "event",
      intent: ["event:user.created"],
      observed: { contractIds: [], eventIds: ["user.created"] },
    }),
    evidence({
      id: "task",
      intent: ["task:user.welcome"],
      observed: { contractIds: [], taskIds: ["user.welcome"] },
    }),
    evidence({
      id: "provider",
      intent: ["provider:@croco/storage-s3/s3/upload"],
      observed: { contractIds: [], providerIds: ["@croco/storage-s3/s3/upload"] },
    }),
    evidence({
      id: "journey",
      intent: ["journey:user-signup"],
      observed: {
        contractIds: [],
        eventIds: ["user.created"],
        routeIds: ["UsersController.create"],
        spanIds: ["user.signup"],
      },
    }),
  ];
}

describe("Executable Assurance Graph", () => {
  it("compiles existing artifacts into stable behavior nodes and obligations", () => {
    const graph = createGraph();

    expect(graph.schemaVersion).toBe("croco.executable-assurance-graph/v1");
    expect(graph.artifactVersions).toEqual({
      contractGraph: "croco.contract-graph.snapshot.v1",
      criticalJourneys: "croco.critical-journeys/v1",
      frameworkManifest: "croco.framework-manifest.v1",
      problemRegistry: "croco.problem-code-registry.v1",
      providerConformance: "croco.provider-conformance.manifest.v1",
      providerProfile: "croco.saas-provider-profile/v1",
      projectMap: "croco.project-map.manifest.v1",
      "projectMap+providerProfile": "croco.project-map.manifest.v1+croco.saas-provider-profile/v1",
      publicApi: "croco.public-api-surface/v2",
      runtimeCapability: "croco.runtime-capability.manifest.v1",
      tasks: "croco.task-metadata/v1",
    });
    expect(graph.nodes.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "event:user.created",
        "event-handler:UserCreatedHandler",
        "journey:user-signup",
        "problem:USER_EMAIL_CONFLICT",
        "provider:@croco/storage-s3/s3/upload",
        "provider-profile:saas-node/@croco/storage-s3",
        "route:UsersController.create",
        "runtime:node/requestLifecycle",
        "task:user.welcome",
      ]),
    );
    expect(graph.obligations).toHaveLength(7);
    expect(
      graph.nodes.filter(({ id }) => id === "provider-profile:saas-node/@croco/storage-s3"),
    ).toEqual([expect.objectContaining({ artifact: "projectMap+providerProfile" })]);
  });

  it("can derive route and Problem obligations from a generated Project Map", () => {
    const graph = createExecutableAssuranceGraph({
      projectMap: {
        version: "croco.project-map.manifest.v1",
        routeGraph: {
          routes: [
            {
              id: "HealthController.read",
              method: "GET",
              path: "/health",
              source: { path: "src/controllers/HealthController.ts", line: 9 },
            },
          ],
        },
        problems: {
          responses: [{ routeId: "HealthController.read", code: "HEALTH_UNAVAILABLE" }],
        },
      },
    });

    expect(graph.nodes).toEqual([
      expect.objectContaining({ id: "problem:HEALTH_UNAVAILABLE", artifact: "projectMap" }),
      expect.objectContaining({ id: "route:HealthController.read", artifact: "projectMap" }),
    ]);
    expect(graph.obligations.map(({ behaviorId }) => behaviorId)).toEqual([
      "problem:HEALTH_UNAVAILABLE",
      "route:HealthController.read#problem:HEALTH_UNAVAILABLE",
      "route:HealthController.read",
    ]);
  });

  it("merges Project Map-only routes and rejects conflicting duplicate artifacts", () => {
    const projectMap = {
      version: "croco.project-map.manifest.v1" as const,
      routeGraph: {
        routes: [{ id: "HealthController.read", method: "GET", path: "/health" }],
      },
      problems: { responses: [] },
    };
    const graph = createExecutableAssuranceGraph({
      contractGraph: { ...contractGraph(), controllers: [], routes: [], routeCount: 0 },
      projectMap,
    });

    expect(graph.nodes.map(({ id }) => id)).toContain("route:HealthController.read");
    expect(() =>
      createExecutableAssuranceGraph({
        contractGraph: contractGraph(),
        projectMap: {
          ...projectMap,
          routeGraph: {
            routes: [{ id: "UsersController.create", method: "GET", path: "/wrong" }],
          },
        },
      }),
    ).toThrow(ExecutableAssuranceContractProblem);
  });

  it("rejects drift between Project Map and standalone provider-profile artifacts", () => {
    expect(() =>
      createExecutableAssuranceGraph({
        projectMap: {
          version: "croco.project-map.manifest.v1",
          routeGraph: { routes: [] },
          problems: { responses: [] },
          packageGraph: {
            providerProfile: { profileName: "saas-node", packages: ["@croco/storage-s3"] },
          },
        },
        providerProfile: {
          schemaVersion: "croco.saas-provider-profile/v1",
          profile: { name: "saas-cloudflare" },
          packages: ["@croco/storage-r2"],
        },
      }),
    ).toThrow("Project Map and provider-profile artifact disagree");
  });

  it("satisfies obligations only when intent, observation, outcome, and fidelity agree", () => {
    const report = evaluateExecutableAssuranceGraph(
      createGraph(),
      createTestEvidenceBundle(completeEvidence()),
      { mode: "enforce" },
    );

    expect(report.status).toBe("passed");
    expect(report.summary).toEqual({
      blockingUnsatisfied: 0,
      contradictory: 0,
      missing: 0,
      satisfied: 7,
      stale: 0,
    });
    expect(() => assertExecutableAssuranceSatisfied(report)).not.toThrow();
  });

  it("rejects otherwise satisfying evidence when a required artifact is missing", () => {
    const records = completeEvidence().map((record) =>
      record.id === "route-success"
        ? evidence({
            id: record.id,
            intent: record.intent.contractIds,
            observed: record.observed,
            attachments: [{ path: "artifacts/route-success.json", kind: "report" }],
          })
        : record,
    );
    const report = evaluateExecutableAssuranceGraph(
      createGraph(),
      createTestEvidenceBundle(records, () => false),
      { mode: "enforce" },
    );

    expect(report.status).toBe("failed");
    expect(report.contradictory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          obligation: expect.objectContaining({ behaviorId: "route:UsersController.create" }),
          reasons: [
            "Evidence 'route-success' is missing required artifact 'artifacts/route-success.json'.",
          ],
        }),
      ]),
    );
  });

  it("accepts adapter evidence for an application-minimum route obligation", () => {
    const records = completeEvidence().map((record) =>
      record.id === "route-success"
        ? evidence({
            id: record.id,
            intent: record.intent.contractIds,
            observed: record.observed,
            fidelity: { ...applicationFidelity, boot: "adapter" },
          })
        : record,
    );

    expect(
      evaluateExecutableAssuranceGraph(createGraph(), createTestEvidenceBundle(records), {
        mode: "enforce",
      }).status,
    ).toBe("passed");
  });

  it("reports declaration without observation as contradictory evidence", () => {
    const records = completeEvidence().map((record) =>
      record.id === "route-problem"
        ? evidence({
            id: record.id,
            intent: record.intent.contractIds,
            observed: { contractIds: [], routeIds: ["UsersController.create"] },
          })
        : record,
    );
    const report = evaluateExecutableAssuranceGraph(
      createGraph(),
      createTestEvidenceBundle(records),
    );

    expect(report.status).toBe("advisory");
    expect(report.contradictory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          obligation: expect.objectContaining({
            behaviorId: "route:UsersController.create#problem:USER_EMAIL_CONFLICT",
          }),
          reasons: expect.arrayContaining([
            expect.stringContaining("did not observe problemCodes 'USER_EMAIL_CONFLICT'"),
          ]),
        }),
      ]),
    );
  });

  it("rejects a successful route call that never validates the response contract", () => {
    const records = completeEvidence().map((record) =>
      record.id === "route-success"
        ? evidence({
            id: record.id,
            intent: record.intent.contractIds,
            observed: { contractIds: [], routeIds: ["UsersController.create"] },
          })
        : record,
    );
    const report = evaluateExecutableAssuranceGraph(
      createGraph(),
      createTestEvidenceBundle(records),
      { mode: "enforce" },
    );

    expect(report.status).toBe("failed");
    expect(report.contradictory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          obligation: expect.objectContaining({ behaviorId: "route:UsersController.create" }),
          reasons: expect.arrayContaining([
            expect.stringContaining(
              "did not observe contractIds 'route:UsersController.create#response'",
            ),
          ]),
        }),
      ]),
    );
  });

  it("reports observation without declared intent as insufficient", () => {
    const records = completeEvidence().filter(({ id }) => id !== "task");
    records.push(
      evidence({
        id: "task-observation-only",
        intent: [],
        observed: { contractIds: [], taskIds: ["user.welcome"] },
      }),
    );
    const report = evaluateExecutableAssuranceGraph(
      createGraph(),
      createTestEvidenceBundle(records),
    );

    expect(report.missing).toEqual([
      expect.objectContaining({
        obligation: expect.objectContaining({ behaviorId: "task:user.welcome" }),
      }),
    ]);
    expect(report.contradictory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceId: "task-observation-only",
          observation: { field: "taskIds", id: "user.welcome" },
        }),
      ]),
    );
    expect(report.summary.blockingUnsatisfied).toBe(1);
  });

  it("rejects rollback fidelity for a commit-level critical journey", () => {
    const records = completeEvidence().map((record) =>
      record.id === "journey"
        ? evidence({
            id: record.id,
            intent: record.intent.contractIds,
            observed: record.observed,
            fidelity: { ...applicationFidelity, isolation: "rollback" },
          })
        : record,
    );
    const report = evaluateExecutableAssuranceGraph(
      createGraph(),
      createTestEvidenceBundle(records),
      { mode: "enforce" },
    );

    expect(report.status).toBe("failed");
    expect(report.contradictory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasons: expect.arrayContaining([
            expect.stringContaining("isolation is 'rollback', which does not satisfy 'commit'"),
          ]),
        }),
      ]),
    );
    expect(() => assertExecutableAssuranceSatisfied(report)).toThrow(
      ExecutableAssuranceUnsatisfiedProblem,
    );
  });

  it("keeps non-blocking enforcement findings advisory", () => {
    const graph = createGraph();
    const nonBlockingGraph: ExecutableAssuranceGraph = {
      ...graph,
      obligations: graph.obligations.map((obligation, index) =>
        index === 0 ? { ...obligation, blocking: false } : obligation,
      ),
    };
    const evidenceRecords = completeEvidence().filter(
      ({ intent }) =>
        !intent.contractIds.includes(nonBlockingGraph.obligations[0]?.behaviorId ?? ""),
    );
    const report = evaluateExecutableAssuranceGraph(
      nonBlockingGraph,
      createTestEvidenceBundle(evidenceRecords),
      { mode: "enforce" },
    );

    expect(report.status).toBe("advisory");
    expect(report.summary.blockingUnsatisfied).toBe(0);
  });

  it("rejects unknown minimum fidelity fields and values at the graph boundary", () => {
    const graph = createGraph();
    const invalidValue = {
      ...graph,
      obligations: [
        { ...graph.obligations[0], minimumFidelity: { boot: "not-a-fidelity" } },
        ...graph.obligations.slice(1),
      ],
    } as unknown as ExecutableAssuranceGraph;
    const invalidField = {
      ...graph,
      obligations: [
        { ...graph.obligations[0], minimumFidelity: { environment: "production" } },
        ...graph.obligations.slice(1),
      ],
    } as unknown as ExecutableAssuranceGraph;

    expect(() => assertExecutableAssuranceGraph(invalidValue)).toThrow(
      ExecutableAssuranceContractProblem,
    );
    expect(() => assertExecutableAssuranceGraph(invalidField)).toThrow(
      ExecutableAssuranceContractProblem,
    );
  });

  it("identifies renamed or removed behavior IDs as stale evidence", () => {
    const records = completeEvidence();
    records.push(
      evidence({
        id: "old-route",
        intent: ["route:UsersController.register"],
        observed: { contractIds: ["route:UsersController.register"] },
      }),
    );
    const report = evaluateExecutableAssuranceGraph(
      createGraph(),
      createTestEvidenceBundle(records),
    );

    expect(report.stale).toEqual([
      expect.objectContaining({
        evidenceId: "old-route",
        field: "intent.contractIds",
        unknownId: "route:UsersController.register",
      }),
      expect.objectContaining({
        evidenceId: "old-route",
        field: "observed.contractIds",
        unknownId: "route:UsersController.register",
      }),
    ]);
  });

  it("keeps the final removed observation stale after its artifact disappears", () => {
    const report = evaluateExecutableAssuranceGraph(
      createExecutableAssuranceGraph({}),
      createTestEvidenceBundle([
        evidence({
          id: "removed-route",
          intent: [],
          observed: { contractIds: [], routeIds: ["RemovedController.read"] },
        }),
      ]),
    );

    expect(report.stale).toEqual([
      expect.objectContaining({
        evidenceId: "removed-route",
        field: "observed.routeIds",
        unknownId: "RemovedController.read",
      }),
    ]);
  });

  it("emits deterministic JSON and Markdown with source and recovery guidance", () => {
    const graph = createGraph();
    const report = evaluateExecutableAssuranceGraph(graph, createTestEvidenceBundle([]));

    expect(serializeExecutableAssurance(graph)).toBe(serializeExecutableAssurance(createGraph()));
    expect(serializeExecutableAssurance(report)).toBe(
      serializeExecutableAssurance(
        evaluateExecutableAssuranceGraph(graph, createTestEvidenceBundle([])),
      ),
    );
    expect(renderExecutableAssuranceMarkdown(report)).toContain(
      "`obligation:route:UsersController.create:success` (src/controllers/UsersController.ts:21)",
    );
    expect(renderExecutableAssuranceMarkdown(report)).toContain(
      'Recovery: `pnpm test -- -t "UsersController.create"`',
    );
  });

  it("canonicalizes nested object key order during serialization", () => {
    const graph = createGraph();
    const reordered = {
      ...graph,
      artifactVersions: Object.fromEntries(Object.entries(graph.artifactVersions).reverse()),
      nodes: graph.nodes.map((node) =>
        node.source
          ? {
              ...node,
              source: Object.fromEntries(Object.entries(node.source).reverse()),
            }
          : node,
      ),
    } as ExecutableAssuranceGraph;

    expect(serializeExecutableAssurance(reordered)).toBe(serializeExecutableAssurance(graph));
  });

  it("leaves unit tests without public behavior obligations unclassified", () => {
    const graph = createExecutableAssuranceGraph({});
    const bundle = createTestEvidenceBundle([
      evidence({
        id: "unit/math",
        intent: ["unit:add"],
        observed: { contractIds: ["unit:add"] },
      }),
    ]);

    expect(evaluateExecutableAssuranceGraph(graph, bundle)).toMatchObject({
      status: "passed",
      summary: { blockingUnsatisfied: 0, contradictory: 0, missing: 0, stale: 0 },
    });
  });

  it("keeps informational artifact nodes non-blocking without misclassifying their evidence as stale", () => {
    const graph = createExecutableAssuranceGraph({
      publicApi: {
        schemaVersion: 2,
        packages: [
          {
            packageName: "@croco/testing",
            entrypoints: [
              {
                exportPath: ".",
                runtimeExports: [
                  {
                    name: "createExecutableAssuranceGraph",
                    source: "./libs/executable-assurance.mjs",
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const publicApiId = "public-api:@croco/testing#runtime:createExecutableAssuranceGraph";
    const bundle = createTestEvidenceBundle([
      evidence({
        id: "public-api-import",
        intent: [publicApiId],
        observed: { contractIds: [publicApiId] },
      }),
    ]);

    expect(graph.nodes.map(({ id }) => id)).toContain(publicApiId);
    expect(evaluateExecutableAssuranceGraph(graph, bundle)).toMatchObject({
      status: "passed",
      summary: { blockingUnsatisfied: 0, contradictory: 0, missing: 0, stale: 0 },
    });
  });

  it("consolidates duplicate public export declarations into one behavior node", () => {
    const graph = createExecutableAssuranceGraph({
      publicApi: {
        schemaVersion: 2,
        packages: [
          {
            packageName: "@croco/testing",
            entrypoints: [
              {
                exportPath: ".",
                typeExports: [
                  { name: "SharedType", source: "./types" },
                  { name: "SharedType", source: "./reexport" },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(
      graph.nodes.filter(({ id }) => id === "public-api:@croco/testing#type:SharedType"),
    ).toHaveLength(1);
  });
});

function contractGraph(): ContractGraphSnapshot {
  return {
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
          sourceLocation: { path: "src/controllers/UsersController.ts", line: 21, column: 3 },
        },
        access: { guards: [], roles: [] },
        entitlements: [],
        params: [],
        request: { body: null, path: null, query: null, headers: null },
        response: null,
        problems: [
          {
            code: "USER_EMAIL_CONFLICT",
            category: "Conflict",
            status: 409,
          },
        ],
      },
    ],
    diagnostics: [],
  };
}

function problemRegistry(): ProblemCodeRegistry {
  return {
    version: "croco.problem-code-registry.v1",
    problemCount: 1,
    problems: [
      {
        code: "USER_EMAIL_CONFLICT",
        category: "Conflict",
        status: 409,
        title: "Conflict",
        cookbookPath: "/reference/problem-recovery-cookbook/#user-email-conflict",
        recovery: {
          cause: "An account already uses the email.",
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
            file: "src/problems/UserEmailConflictProblem.ts",
            line: 5,
            column: 1,
            kind: "problem-class",
          },
        ],
      },
    ],
  };
}

function frameworkManifest(): FrameworkManifest {
  return {
    version: "croco.framework-manifest.v1",
    schema: {
      entityVocabulary: [],
      sourceLocationFields: ["path", "line", "column"],
      consumerApis: [],
    },
    summary: {
      sourceFiles: 1,
      entities: 2,
      controllers: 0,
      routes: 0,
      providers: 0,
      eventHandlers: 1,
      domainEvents: 1,
      relationships: 0,
    },
    generatedArtifacts: [],
    sourceFiles: [],
    entities: [
      {
        kind: "domain.event",
        id: "UserCreatedEvent",
        name: "UserCreatedEvent",
        eventName: "user.created",
        source: { path: "src/events/UserCreatedEvent.ts", line: 3, column: 1 },
      },
      {
        kind: "event.handler",
        id: "UserCreatedHandler",
        name: "UserCreatedHandler",
        eventName: "user.created",
        eventClassName: "UserCreatedEvent",
        source: { path: "src/events/UserCreatedHandler.ts", line: 4, column: 1 },
      },
    ],
    relationships: [],
    diagnostics: [],
  };
}
