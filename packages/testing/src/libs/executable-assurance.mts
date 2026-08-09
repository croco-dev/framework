import { Problem, ProblemCategory } from "@croco/problems-core";

import type { RuntimeCapabilityManifest } from "@croco/framework-context";
import type { FrameworkManifest, FrameworkManifestSourceLocation } from "@croco/framework-routes";
import type { ProblemCodeRegistry, ProblemRegistrySnapshot } from "@croco/problems-core";
import type { ContractGraphSnapshot } from "@croco/protocols-core";

import type {
  ProviderConformanceMatrixManifest,
  ProviderConformanceProfileManifest,
} from "./provider-conformance-matrix";
import {
  assertTestEvidenceBundle,
  type TestEvidenceBundle,
  type TestEvidenceFidelity,
  type TestEvidenceObservation,
  type TestEvidenceRecord,
} from "./test-evidence.mjs";

export const EXECUTABLE_ASSURANCE_GRAPH_VERSION = "croco.executable-assurance-graph/v1" as const;
export const EXECUTABLE_ASSURANCE_REPORT_VERSION = "croco.executable-assurance-report/v1" as const;

export type ExecutableAssuranceMode = "advisory" | "enforce";
export type AssuranceBehaviorKind =
  | "route"
  | "rpc"
  | "problem"
  | "event"
  | "event-handler"
  | "task"
  | "provider"
  | "journey"
  | "public-api"
  | "runtime"
  | "provider-profile";
export type AssuranceEvidenceStatus = "satisfied" | "missing" | "stale" | "contradictory";
export type AssuranceObservationField =
  | "contractIds"
  | "routeIds"
  | "problemCodes"
  | "eventIds"
  | "taskIds"
  | "spanIds"
  | "providerIds";

export type AssuranceSourceLocation = {
  readonly path: string;
  readonly line?: number;
  readonly column?: number;
  readonly symbol?: string;
};

export type AssuranceRecovery = {
  readonly command: string;
  readonly testTemplate: string;
};

export type AssuranceObservationRequirement = {
  readonly field: AssuranceObservationField;
  readonly id: string;
};

export type AssuranceBehaviorNode = {
  readonly id: string;
  readonly kind: AssuranceBehaviorKind;
  readonly label: string;
  readonly source?: AssuranceSourceLocation | undefined;
  readonly artifact: string;
};

export type AssuranceEvidenceObligation = {
  readonly id: string;
  readonly behaviorId: string;
  readonly nodeId: string;
  readonly blocking: boolean;
  readonly description: string;
  readonly minimumFidelity: Partial<TestEvidenceFidelity>;
  readonly observations: readonly AssuranceObservationRequirement[];
  readonly recovery: AssuranceRecovery;
  readonly source?: AssuranceSourceLocation | undefined;
};

export type ExecutableAssuranceGraph = {
  readonly schemaVersion: typeof EXECUTABLE_ASSURANCE_GRAPH_VERSION;
  readonly nodes: readonly AssuranceBehaviorNode[];
  readonly obligations: readonly AssuranceEvidenceObligation[];
  readonly artifactVersions: Readonly<Record<string, string>>;
};

export type AssuranceRpcContract = {
  readonly id: string;
  readonly operation: string;
  readonly source?: AssuranceSourceLocation | undefined;
  readonly problems?: readonly string[];
};

export type AssuranceTaskArtifact = {
  readonly name: string;
  readonly source?: AssuranceSourceLocation | undefined;
};

export type AssuranceCriticalJourney = {
  readonly id: string;
  readonly description: string;
  readonly observations: readonly AssuranceObservationRequirement[];
  readonly minimumFidelity: Partial<TestEvidenceFidelity>;
  readonly replayCommand: string;
  readonly source?: AssuranceSourceLocation | undefined;
};

export type AssurancePublicApiSnapshot = {
  readonly schemaVersion: number;
  readonly packages: readonly {
    readonly packageName: string;
    readonly entrypoints: readonly {
      readonly exportPath: string;
      readonly runtimeExports?: readonly { readonly name: string; readonly source?: string }[];
      readonly typeExports?: readonly { readonly name: string; readonly source?: string }[];
    }[];
  }[];
};

export type AssuranceProjectMapArtifact = {
  readonly version: "croco.project-map.manifest.v1";
  readonly routeGraph: {
    readonly routes: readonly {
      readonly id: string;
      readonly method: string;
      readonly path: string;
      readonly source?: AssuranceSourceLocation | undefined;
    }[];
  };
  readonly problems: {
    readonly responses: readonly { readonly routeId: string; readonly code: string }[];
  };
};

export type AssuranceProviderProfileArtifact = {
  readonly schemaVersion: string;
  readonly profile?: { readonly name?: string };
  readonly packages?: readonly string[];
};

export type ExecutableAssuranceGraphInput = {
  readonly contractGraph?: ContractGraphSnapshot;
  readonly rpcContracts?: readonly AssuranceRpcContract[];
  readonly problemRegistry?: ProblemRegistrySnapshot | ProblemCodeRegistry;
  readonly frameworkManifest?: FrameworkManifest;
  readonly projectMap?: AssuranceProjectMapArtifact;
  readonly tasks?: readonly AssuranceTaskArtifact[];
  readonly runtimeCapability?: RuntimeCapabilityManifest;
  readonly providerConformance?: ProviderConformanceMatrixManifest;
  readonly providerProfile?: AssuranceProviderProfileArtifact;
  readonly publicApi?: AssurancePublicApiSnapshot;
  readonly criticalJourneys?: readonly AssuranceCriticalJourney[];
};

export type AssuranceObligationAssessment = {
  readonly status: Exclude<AssuranceEvidenceStatus, "stale">;
  readonly obligation: AssuranceEvidenceObligation;
  readonly evidenceIds: readonly string[];
  readonly reasons: readonly string[];
};

export type AssuranceStaleEvidence = {
  readonly status: "stale";
  readonly evidenceId: string;
  readonly field: "intent.contractIds" | `observed.${AssuranceObservationField}`;
  readonly unknownId: string;
  readonly recoveryAction: string;
};

export type AssuranceContradictoryEvidence = {
  readonly status: "contradictory";
  readonly evidenceId: string;
  readonly observation: AssuranceObservationRequirement;
  readonly recoveryAction: string;
};

export type ExecutableAssuranceReport = {
  readonly schemaVersion: typeof EXECUTABLE_ASSURANCE_REPORT_VERSION;
  readonly graphVersion: typeof EXECUTABLE_ASSURANCE_GRAPH_VERSION;
  readonly mode: ExecutableAssuranceMode;
  readonly status: "passed" | "advisory" | "failed";
  readonly summary: {
    readonly satisfied: number;
    readonly missing: number;
    readonly stale: number;
    readonly contradictory: number;
    readonly blockingUnsatisfied: number;
  };
  readonly satisfied: readonly AssuranceObligationAssessment[];
  readonly missing: readonly AssuranceObligationAssessment[];
  readonly stale: readonly AssuranceStaleEvidence[];
  readonly contradictory: readonly (
    | AssuranceObligationAssessment
    | AssuranceContradictoryEvidence
  )[];
};

export class ExecutableAssuranceContractProblem extends Problem {
  readonly code = "CROCO_EXECUTABLE_ASSURANCE_CONTRACT_INVALID";

  constructor(detail: string) {
    super(
      "CROCO_EXECUTABLE_ASSURANCE_CONTRACT_INVALID",
      ProblemCategory.ValidationError,
      `CROCO_EXECUTABLE_ASSURANCE_CONTRACT_INVALID: ${detail}`,
    );
    this.name = "ExecutableAssuranceContractProblem";
  }
}

export class ExecutableAssuranceUnsatisfiedProblem extends Problem {
  readonly code = "CROCO_EXECUTABLE_ASSURANCE_UNSATISFIED";
  readonly report: ExecutableAssuranceReport;

  constructor(report: ExecutableAssuranceReport) {
    super(
      "CROCO_EXECUTABLE_ASSURANCE_UNSATISFIED",
      ProblemCategory.ValidationError,
      `CROCO_EXECUTABLE_ASSURANCE_UNSATISFIED: report has ${report.summary.missing} missing, ${report.summary.stale} stale, and ${report.summary.contradictory} contradictory finding(s). Run the recovery commands in the assurance report.`,
    );
    this.name = "ExecutableAssuranceUnsatisfiedProblem";
    this.report = report;
  }
}

export function assertExecutableAssuranceGraph(
  value: unknown,
): asserts value is ExecutableAssuranceGraph {
  if (!isRecord(value) || value["schemaVersion"] !== EXECUTABLE_ASSURANCE_GRAPH_VERSION) {
    throw new ExecutableAssuranceContractProblem(
      `Graph must declare schemaVersion '${EXECUTABLE_ASSURANCE_GRAPH_VERSION}'.`,
    );
  }
  if (!Array.isArray(value["nodes"]) || !Array.isArray(value["obligations"])) {
    throw new ExecutableAssuranceContractProblem("Graph nodes and obligations must be arrays.");
  }
  if (!isRecord(value["artifactVersions"])) {
    throw new ExecutableAssuranceContractProblem("Graph artifactVersions must be an object.");
  }
  for (const [name, version] of Object.entries(value["artifactVersions"])) {
    assertNonEmpty(name, "Artifact name");
    if (typeof version !== "string" || version.trim().length === 0) {
      throw new ExecutableAssuranceContractProblem(`Artifact '${name}' version must be a string.`);
    }
  }
  const nodes = value["nodes"];
  for (const [index, node] of nodes.entries()) {
    if (!isRecord(node)) {
      throw new ExecutableAssuranceContractProblem(`Graph nodes[${index}] must be an object.`);
    }
    assertNonEmptyValue(node["id"], `Graph nodes[${index}] id`);
    assertNonEmptyValue(node["label"], `Graph nodes[${index}] label`);
    assertNonEmptyValue(node["artifact"], `Graph nodes[${index}] artifact`);
    if (!BEHAVIOR_KINDS.includes(node["kind"] as AssuranceBehaviorKind)) {
      throw new ExecutableAssuranceContractProblem(`Graph nodes[${index}] kind is unsupported.`);
    }
  }
  const nodeIds = new Set(
    nodes.map((node) => String((node as Readonly<Record<string, unknown>>)["id"])),
  );
  const obligations = value["obligations"];
  for (const [index, obligation] of obligations.entries()) {
    if (!isRecord(obligation)) {
      throw new ExecutableAssuranceContractProblem(
        `Graph obligations[${index}] must be an object.`,
      );
    }
    for (const field of ["id", "behaviorId", "nodeId", "description"] as const) {
      assertNonEmptyValue(obligation[field], `Graph obligations[${index}] ${field}`);
    }
    if (obligation["blocking"] !== true && obligation["blocking"] !== false) {
      throw new ExecutableAssuranceContractProblem(
        `Graph obligations[${index}] blocking must be boolean.`,
      );
    }
    if (
      !nodeIds.has(String(obligation["nodeId"])) ||
      !isAssuranceId(String(obligation["behaviorId"]))
    ) {
      throw new ExecutableAssuranceContractProblem(
        `Graph obligations[${index}] must reference a known node and stable behavior id.`,
      );
    }
    if (
      !Array.isArray(obligation["observations"]) ||
      !isRecord(obligation["recovery"]) ||
      !isRecord(obligation["minimumFidelity"])
    ) {
      throw new ExecutableAssuranceContractProblem(
        `Graph obligations[${index}] observations, minimumFidelity, and recovery are required.`,
      );
    }
    assertMinimumFidelity(obligation["minimumFidelity"], index);
    for (const [observationIndex, observation] of obligation["observations"].entries()) {
      if (
        !isRecord(observation) ||
        !OBSERVATION_FIELDS.includes(observation["field"] as AssuranceObservationField) ||
        typeof observation["id"] !== "string" ||
        observation["id"].trim().length === 0
      ) {
        throw new ExecutableAssuranceContractProblem(
          `Graph obligations[${index}] observations[${observationIndex}] is invalid.`,
        );
      }
    }
    assertNonEmptyValue(
      obligation["recovery"]["command"],
      `Graph obligations[${index}] recovery command`,
    );
    assertNonEmptyValue(
      obligation["recovery"]["testTemplate"],
      `Graph obligations[${index}] recovery testTemplate`,
    );
  }
  assertUnique(
    nodes.map((node) => String((node as Readonly<Record<string, unknown>>)["id"])),
    "behavior node",
  );
  assertUnique(
    obligations.map((obligation) =>
      String((obligation as Readonly<Record<string, unknown>>)["id"]),
    ),
    "evidence obligation",
  );
}

export function createExecutableAssuranceGraph(
  input: ExecutableAssuranceGraphInput,
): ExecutableAssuranceGraph {
  const nodes: AssuranceBehaviorNode[] = [];
  const obligations: AssuranceEvidenceObligation[] = [];
  const artifactVersions: Record<string, string> = {};
  const runtimeFidelity = runtimeFidelityRequirement(input.runtimeCapability);

  if (input.contractGraph) {
    artifactVersions["contractGraph"] = input.contractGraph.snapshotVersion;
    for (const route of input.contractGraph.routes) {
      const nodeId = behaviorId("route", route.routeId);
      const source = toSource(route.routeContract?.sourceLocation);
      addNode(nodes, {
        id: nodeId,
        kind: "route",
        label: `${route.httpMethod} ${route.path}`,
        source,
        artifact: "contractGraph",
      });
      obligations.push(
        createObligation({
          nodeId,
          behaviorId: nodeId,
          suffix: "success",
          description: `Public route '${route.routeId}' returns its declared success response.`,
          observations: [
            { field: "routeIds", id: route.routeId },
            { field: "contractIds", id: responseContractId(nodeId) },
          ],
          source,
          recovery: routeRecovery(route.routeId),
          minimumFidelity: {
            boot: "application",
            validation: "production",
            ...runtimeFidelity,
          },
        }),
      );
      for (const problem of route.problems) {
        const routeProblemId = `${nodeId}#problem:${problem.code}`;
        obligations.push(
          createObligation({
            nodeId,
            behaviorId: routeProblemId,
            suffix: `problem:${problem.code}`,
            description: `Public route '${route.routeId}' returns declared Problem '${problem.code}'.`,
            observations: [
              { field: "routeIds", id: route.routeId },
              { field: "problemCodes", id: problem.code },
            ],
            source,
            recovery: problemRecovery(problem.code, routeProblemId),
            minimumFidelity: {
              boot: "application",
              validation: "production",
              ...runtimeFidelity,
            },
          }),
        );
      }
    }
  }

  if (input.projectMap) {
    artifactVersions["projectMap"] = input.projectMap.version;
    const contractRoutes = new Map(
      (input.contractGraph?.routes ?? []).map((route) => [route.routeId, route]),
    );
    for (const route of input.projectMap.routeGraph.routes) {
      const contractRoute = contractRoutes.get(route.id);
      if (contractRoute) {
        assertProjectMapRouteCompatible(contractRoute, route, input.projectMap);
      } else {
        const nodeId = behaviorId("route", route.id);
        addNode(nodes, {
          id: nodeId,
          kind: "route",
          label: `${route.method} ${route.path}`,
          source: route.source,
          artifact: "projectMap",
        });
        obligations.push(
          createObligation({
            nodeId,
            behaviorId: nodeId,
            suffix: "success",
            description: `Public route '${route.id}' returns its declared success response.`,
            observations: [
              { field: "routeIds", id: route.id },
              { field: "contractIds", id: responseContractId(nodeId) },
            ],
            source: route.source,
            recovery: routeRecovery(route.id),
            minimumFidelity: {
              boot: "application",
              validation: "production",
              ...runtimeFidelity,
            },
          }),
        );
        for (const problem of input.projectMap.problems.responses.filter(
          ({ routeId }) => routeId === route.id,
        )) {
          const routeProblemId = `${nodeId}#problem:${problem.code}`;
          obligations.push(
            createObligation({
              nodeId,
              behaviorId: routeProblemId,
              suffix: `problem:${problem.code}`,
              description: `Public route '${route.id}' returns declared Problem '${problem.code}'.`,
              observations: [
                { field: "routeIds", id: route.id },
                { field: "problemCodes", id: problem.code },
              ],
              source: route.source,
              recovery: problemRecovery(problem.code, routeProblemId),
              minimumFidelity: {
                boot: "application",
                validation: "production",
                ...runtimeFidelity,
              },
            }),
          );
        }
      }
    }
    if (!input.problemRegistry) {
      for (const problem of uniqueProjectMapProblems(input.projectMap)) {
        const nodeId = behaviorId("problem", problem.code);
        addNode(nodes, {
          id: nodeId,
          kind: "problem",
          label: problem.code,
          source: problem.source,
          artifact: "projectMap",
        });
        obligations.push(
          createObligation({
            nodeId,
            behaviorId: nodeId,
            suffix: "public",
            description: `Declared Problem '${problem.code}' is asserted and observed.`,
            observations: [{ field: "problemCodes", id: problem.code }],
            source: problem.source,
            recovery: problemRecovery(problem.code),
            minimumFidelity: {},
          }),
        );
      }
    }
  }

  if (input.rpcContracts) {
    artifactVersions["rpcContracts"] = "croco.rpc-contracts/v1";
    for (const rpc of input.rpcContracts) {
      const nodeId = behaviorId("rpc", rpc.id);
      addNode(nodes, {
        id: nodeId,
        kind: "rpc",
        label: rpc.operation,
        source: rpc.source,
        artifact: "rpcContracts",
      });
      obligations.push(
        createObligation({
          nodeId,
          behaviorId: nodeId,
          suffix: "success",
          description: `Public RPC contract '${rpc.id}' returns its declared success result.`,
          observations: [{ field: "contractIds", id: responseContractId(nodeId) }],
          source: rpc.source,
          recovery: genericRecovery("rpc", rpc.id),
          minimumFidelity: {
            boot: "application",
            validation: "production",
            ...runtimeFidelity,
          },
        }),
      );
      for (const code of rpc.problems ?? []) {
        const rpcProblemId = `${nodeId}#problem:${code}`;
        obligations.push(
          createObligation({
            nodeId,
            behaviorId: rpcProblemId,
            suffix: `problem:${code}`,
            description: `Public RPC contract '${rpc.id}' returns declared Problem '${code}'.`,
            observations: [
              { field: "contractIds", id: nodeId },
              { field: "problemCodes", id: code },
            ],
            source: rpc.source,
            recovery: problemRecovery(code, rpcProblemId),
            minimumFidelity: {
              boot: "application",
              validation: "production",
              ...runtimeFidelity,
            },
          }),
        );
      }
    }
  }

  if (input.problemRegistry) {
    artifactVersions["problemRegistry"] = isProblemCodeRegistry(input.problemRegistry)
      ? input.problemRegistry.version
      : input.problemRegistry.snapshotVersion;
    const problems = isProblemCodeRegistry(input.problemRegistry)
      ? input.problemRegistry.problems
      : input.problemRegistry.problems.filter(({ public: isPublic }) => isPublic);
    for (const problem of problems) {
      const nodeId = behaviorId("problem", problem.code);
      const registrySource = "sources" in problem ? problem.sources[0] : undefined;
      const source = registrySource
        ? {
            path: registrySource.file,
            line: registrySource.line,
            column: registrySource.column,
          }
        : undefined;
      addNode(nodes, {
        id: nodeId,
        kind: "problem",
        label: problem.code,
        source,
        artifact: "problemRegistry",
      });
      obligations.push(
        createObligation({
          nodeId,
          behaviorId: nodeId,
          suffix: "public",
          description: `Public Problem '${problem.code}' is asserted and observed.`,
          observations: [{ field: "problemCodes", id: problem.code }],
          source,
          recovery: problemRecovery(problem.code),
          minimumFidelity: {},
        }),
      );
    }
  }

  if (input.frameworkManifest) {
    artifactVersions["frameworkManifest"] = input.frameworkManifest.version;
    for (const entity of input.frameworkManifest.entities) {
      if (entity.kind === "domain.event") {
        const nodeId = behaviorId("event", entity.eventName);
        const source = toSource(entity.source);
        addNode(nodes, {
          id: nodeId,
          kind: "event",
          label: entity.eventName,
          source,
          artifact: "frameworkManifest",
        });
        obligations.push(
          createObligation({
            nodeId,
            behaviorId: nodeId,
            suffix: "dispatch",
            description: `Domain event '${entity.eventName}' is asserted and observed.`,
            observations: [{ field: "eventIds", id: entity.eventName }],
            source,
            recovery: genericRecovery("event", entity.eventName),
            minimumFidelity: {},
          }),
        );
      }
      if (entity.kind === "event.handler") {
        addNode(nodes, {
          id: behaviorId("event-handler", entity.id),
          kind: "event-handler",
          label: `${entity.name} handles ${entity.eventName}`,
          source: toSource(entity.source),
          artifact: "frameworkManifest",
        });
      }
    }
  }

  if (input.tasks) {
    artifactVersions["tasks"] = "croco.task-metadata/v1";
    for (const task of input.tasks) {
      const nodeId = behaviorId("task", task.name);
      addNode(nodes, {
        id: nodeId,
        kind: "task",
        label: task.name,
        source: task.source,
        artifact: "tasks",
      });
      obligations.push(
        createObligation({
          nodeId,
          behaviorId: nodeId,
          suffix: "execute",
          description: `Task '${task.name}' is asserted and observed.`,
          observations: [{ field: "taskIds", id: task.name }],
          source: task.source,
          recovery: genericRecovery("task", task.name),
          minimumFidelity: {},
        }),
      );
    }
  }

  if (input.providerConformance) {
    artifactVersions["providerConformance"] = input.providerConformance.version;
    for (const profile of input.providerConformance.profiles) {
      addProviderProfile(nodes, obligations, profile, runtimeFidelity);
    }
  }

  if (input.providerProfile) {
    artifactVersions["providerProfile"] = input.providerProfile.schemaVersion;
    for (const packageName of input.providerProfile.packages ?? []) {
      const profileName = input.providerProfile.profile?.name ?? "unknown";
      addNode(nodes, {
        id: behaviorId("provider-profile", `${profileName}/${packageName}`),
        kind: "provider-profile",
        label: `${profileName}: ${packageName}`,
        artifact: "providerProfile",
      });
    }
  }

  if (input.runtimeCapability) {
    artifactVersions["runtimeCapability"] = input.runtimeCapability.version;
    for (const [capability, supported] of Object.entries(input.runtimeCapability.capabilities)) {
      if (!supported) continue;
      addNode(nodes, {
        id: behaviorId("runtime", `${input.runtimeCapability.platform}/${capability}`),
        kind: "runtime",
        label: `${input.runtimeCapability.platform} ${capability}`,
        artifact: "runtimeCapability",
      });
    }
  }

  if (input.publicApi) {
    artifactVersions["publicApi"] = `croco.public-api-surface/v${input.publicApi.schemaVersion}`;
    for (const packageEntry of input.publicApi.packages) {
      for (const entrypoint of packageEntry.entrypoints) {
        for (const [exportKind, exports] of [
          ["runtime", entrypoint.runtimeExports ?? []],
          ["type", entrypoint.typeExports ?? []],
        ] as const) {
          for (const exported of exports) {
            addNode(nodes, {
              id: behaviorId(
                "public-api",
                `${publicApiEntrypointId(packageEntry.packageName, entrypoint.exportPath)}#${exportKind}:${exported.name}`,
              ),
              kind: "public-api",
              label: `${publicApiEntrypointId(packageEntry.packageName, entrypoint.exportPath)} ${exported.name}`,
              source: exported.source ? { path: exported.source } : undefined,
              artifact: "publicApi",
            });
          }
        }
      }
    }
  }

  if (input.criticalJourneys) {
    artifactVersions["criticalJourneys"] = "croco.critical-journeys/v1";
    for (const journey of input.criticalJourneys) {
      const nodeId = behaviorId("journey", journey.id);
      addNode(nodes, {
        id: nodeId,
        kind: "journey",
        label: journey.description,
        source: journey.source,
        artifact: "criticalJourneys",
      });
      obligations.push(
        createObligation({
          nodeId,
          behaviorId: nodeId,
          suffix: "complete",
          description: journey.description,
          observations: journey.observations,
          source: journey.source,
          recovery: {
            command: journey.replayCommand,
            testTemplate: `Declare intent '${nodeId}' and assert every listed runtime observation.`,
          },
          minimumFidelity: journey.minimumFidelity,
        }),
      );
    }
  }

  assertUnique(
    nodes.map(({ id }) => id),
    "behavior node",
  );
  assertUnique(
    obligations.map(({ id }) => id),
    "evidence obligation",
  );

  return deepFreeze({
    schemaVersion: EXECUTABLE_ASSURANCE_GRAPH_VERSION,
    nodes: nodes.sort((left, right) => compareStrings(left.id, right.id)),
    obligations: obligations.sort((left, right) => compareStrings(left.id, right.id)),
    artifactVersions: Object.fromEntries(
      Object.entries(artifactVersions).sort(([left], [right]) => compareStrings(left, right)),
    ),
  });
}

export function evaluateExecutableAssuranceGraph(
  graph: ExecutableAssuranceGraph,
  evidence: TestEvidenceBundle,
  options: { readonly mode?: ExecutableAssuranceMode } = {},
): ExecutableAssuranceReport {
  assertExecutableAssuranceGraph(graph);
  assertTestEvidenceBundle(evidence);
  const mode = options.mode ?? "advisory";
  const knownBehaviorIds = new Set([
    ...graph.nodes.map(({ id }) => id),
    ...graph.obligations.map(({ behaviorId }) => behaviorId),
  ]);
  const knownObservationIds = collectKnownObservationIds(graph.obligations);
  const missingArtifactsByRecord = collectMissingArtifactsByRecord(evidence);
  const assessments = graph.obligations.map((obligation) =>
    assessObligation(obligation, evidence.records, missingArtifactsByRecord),
  );
  const stale = collectStaleEvidence(evidence.records, knownBehaviorIds, knownObservationIds);
  const orphanObservations = collectOrphanObservations(evidence.records, graph.obligations);
  const satisfied = assessments.filter(({ status }) => status === "satisfied");
  const missing = assessments.filter(({ status }) => status === "missing");
  const contradictoryAssessments = assessments.filter(({ status }) => status === "contradictory");
  const contradictory = [...contradictoryAssessments, ...orphanObservations].sort(
    compareContradictions,
  );
  const blockingUnsatisfied = assessments.filter(
    ({ obligation, status }) => obligation.blocking && status !== "satisfied",
  ).length;
  const hasFindings = missing.length > 0 || stale.length > 0 || contradictory.length > 0;
  const status =
    mode === "enforce" && blockingUnsatisfied > 0 ? "failed" : hasFindings ? "advisory" : "passed";

  return deepFreeze({
    schemaVersion: EXECUTABLE_ASSURANCE_REPORT_VERSION,
    graphVersion: graph.schemaVersion,
    mode,
    status,
    summary: {
      satisfied: satisfied.length,
      missing: missing.length,
      stale: stale.length,
      contradictory: contradictory.length,
      blockingUnsatisfied,
    },
    satisfied,
    missing,
    stale,
    contradictory,
  });
}

export function assertExecutableAssuranceSatisfied(report: ExecutableAssuranceReport): void {
  if (report.status === "failed") {
    throw new ExecutableAssuranceUnsatisfiedProblem(report);
  }
}

export function serializeExecutableAssurance(
  value: ExecutableAssuranceGraph | ExecutableAssuranceReport,
): string {
  return `${JSON.stringify(canonicalizeJson(value), null, 2)}\n`;
}

export function renderExecutableAssuranceMarkdown(report: ExecutableAssuranceReport): string {
  const lines = [
    "# Executable Assurance",
    "",
    `- Schema: \`${report.schemaVersion}\``,
    `- Mode: \`${report.mode}\``,
    `- Status: **${report.status.toUpperCase()}**`,
    `- Satisfied: ${report.summary.satisfied}`,
    `- Missing: ${report.summary.missing}`,
    `- Stale: ${report.summary.stale}`,
    `- Contradictory: ${report.summary.contradictory}`,
    "",
  ];

  appendAssessmentSection(lines, "Satisfied", report.satisfied);
  appendAssessmentSection(lines, "Missing", report.missing);
  appendStaleSection(lines, report.stale);
  appendContradictorySection(lines, report.contradictory);
  return `${lines.join("\n")}\n`;
}

type CreateObligationInput = Omit<AssuranceEvidenceObligation, "id" | "blocking"> & {
  readonly suffix: string;
};

function createObligation(input: CreateObligationInput): AssuranceEvidenceObligation {
  const { suffix, ...obligation } = input;
  return {
    ...obligation,
    id: `obligation:${input.nodeId}:${suffix}`,
    blocking: true,
    observations: [...input.observations].sort(compareObservations),
  };
}

function addProviderProfile(
  nodes: AssuranceBehaviorNode[],
  obligations: AssuranceEvidenceObligation[],
  profile: ProviderConformanceProfileManifest,
  runtimeFidelity: Partial<TestEvidenceFidelity>,
): void {
  for (const capability of profile.capabilities.filter(
    ({ required, supported }) => required && supported,
  )) {
    const providerId = `${profile.packageName}/${profile.providerName}/${capability.name}`;
    const nodeId = behaviorId("provider", providerId);
    addNode(nodes, {
      id: nodeId,
      kind: "provider",
      label: providerId,
      artifact: "providerConformance",
    });
    obligations.push(
      createObligation({
        nodeId,
        behaviorId: nodeId,
        suffix: "capability",
        description: `Provider capability '${providerId}' satisfies its conformance contract.`,
        observations: [{ field: "providerIds", id: providerId }],
        recovery: genericRecovery("provider", providerId),
        minimumFidelity: runtimeFidelity,
      }),
    );
  }
}

function addNode(nodes: AssuranceBehaviorNode[], node: AssuranceBehaviorNode): void {
  nodes.push(node);
}

function assessObligation(
  obligation: AssuranceEvidenceObligation,
  records: readonly TestEvidenceRecord[],
  missingArtifactsByRecord: ReadonlyMap<string, readonly string[]>,
): AssuranceObligationAssessment {
  const declared = records.filter(({ intent }) =>
    intent.contractIds.includes(obligation.behaviorId),
  );
  if (declared.length === 0) {
    return {
      status: "missing",
      obligation,
      evidenceIds: [],
      reasons: [`No evidence declares intent '${obligation.behaviorId}'.`],
    };
  }

  const satisfied = declared.find(
    (record) =>
      record.outcome === "passed" &&
      !missingArtifactsByRecord.has(record.id) &&
      matchesFidelity(record.fidelity, obligation.minimumFidelity) &&
      obligation.observations.every((observation) => observationMatches(record, observation)),
  );
  if (satisfied) {
    return {
      status: "satisfied",
      obligation,
      evidenceIds: [satisfied.id],
      reasons: [],
    };
  }

  return {
    status: "contradictory",
    obligation,
    evidenceIds: declared.map(({ id }) => id).sort(compareStrings),
    reasons: uniqueStrings(
      declared.flatMap((record) =>
        contradictionReasons(record, obligation, missingArtifactsByRecord.get(record.id) ?? []),
      ),
    ),
  };
}

function contradictionReasons(
  record: TestEvidenceRecord,
  obligation: AssuranceEvidenceObligation,
  missingArtifacts: readonly string[],
): string[] {
  const reasons: string[] = [];
  if (record.outcome !== "passed") {
    reasons.push(`Evidence '${record.id}' outcome is '${record.outcome}', not 'passed'.`);
  }
  for (const path of missingArtifacts) {
    reasons.push(`Evidence '${record.id}' is missing required artifact '${path}'.`);
  }
  for (const [field, expected] of Object.entries(obligation.minimumFidelity)) {
    const fidelityField = field as keyof TestEvidenceFidelity;
    if (!fidelityFieldSatisfied(fidelityField, record.fidelity[fidelityField], expected)) {
      reasons.push(
        `Evidence '${record.id}' fidelity ${field} is '${record.fidelity[fidelityField]}', which does not satisfy '${String(expected)}'.`,
      );
    }
  }
  for (const observation of obligation.observations) {
    if (!observationMatches(record, observation)) {
      reasons.push(
        `Evidence '${record.id}' did not observe ${observation.field} '${observation.id}'.`,
      );
    }
  }
  return reasons;
}

function collectMissingArtifactsByRecord(
  evidence: TestEvidenceBundle,
): ReadonlyMap<string, readonly string[]> {
  const byRecord = new Map<string, string[]>();
  for (const missing of evidence.missingArtifacts) {
    const paths = byRecord.get(missing.recordId) ?? [];
    paths.push(missing.path);
    byRecord.set(missing.recordId, paths);
  }
  return byRecord;
}

function observationMatches(
  record: TestEvidenceRecord,
  requirement: AssuranceObservationRequirement,
): boolean {
  return observationValues(record.observed, requirement.field).includes(requirement.id);
}

function observationValues(
  observed: TestEvidenceObservation,
  field: AssuranceObservationField,
): readonly string[] {
  return observed[field] ?? [];
}

function matchesFidelity(
  actual: TestEvidenceFidelity,
  required: Partial<TestEvidenceFidelity>,
): boolean {
  return Object.entries(required).every(([field, expected]) => {
    const fidelityField = field as keyof TestEvidenceFidelity;
    return fidelityFieldSatisfied(fidelityField, actual[fidelityField], expected);
  });
}

function fidelityFieldSatisfied(
  field: keyof TestEvidenceFidelity,
  actual: string,
  required: unknown,
): boolean {
  if (field === "boot" && required === "application") {
    return actual === "application" || actual === "adapter";
  }
  return actual === required;
}

function collectKnownObservationIds(
  obligations: readonly AssuranceEvidenceObligation[],
): ReadonlyMap<AssuranceObservationField, ReadonlySet<string>> {
  const values = new Map<AssuranceObservationField, Set<string>>(
    OBSERVATION_FIELDS.map((field) => [field, new Set<string>()]),
  );
  for (const obligation of obligations) {
    for (const observation of obligation.observations) {
      const ids = values.get(observation.field) ?? new Set<string>();
      ids.add(observation.id);
      values.set(observation.field, ids);
    }
  }
  return values;
}

function collectStaleEvidence(
  records: readonly TestEvidenceRecord[],
  knownBehaviorIds: ReadonlySet<string>,
  knownObservationIds: ReadonlyMap<AssuranceObservationField, ReadonlySet<string>>,
): AssuranceStaleEvidence[] {
  const stale: AssuranceStaleEvidence[] = [];
  for (const record of records) {
    for (const id of record.intent.contractIds) {
      if (isAssuranceId(id) && !knownBehaviorIds.has(id)) {
        stale.push({
          status: "stale",
          evidenceId: record.id,
          field: "intent.contractIds",
          unknownId: id,
          recoveryAction: `Replace or remove stale intent '${id}' after regenerating the assurance graph.`,
        });
      }
    }
    for (const field of OBSERVATION_FIELDS) {
      const observedIds = knownObservationIds.get(field) ?? new Set<string>();
      const known =
        field === "contractIds" ? new Set([...knownBehaviorIds, ...observedIds]) : observedIds;
      for (const id of observationValues(record.observed, field)) {
        if (!known.has(id) && (field !== "contractIds" || isAssuranceId(id))) {
          stale.push({
            status: "stale",
            evidenceId: record.id,
            field: `observed.${field}`,
            unknownId: id,
            recoveryAction: `Update runtime observation '${id}' after regenerating the source artifact.`,
          });
        }
      }
    }
  }
  return stale.sort((left, right) =>
    compareStrings(
      `${left.evidenceId}\0${left.field}\0${left.unknownId}`,
      `${right.evidenceId}\0${right.field}\0${right.unknownId}`,
    ),
  );
}

function collectOrphanObservations(
  records: readonly TestEvidenceRecord[],
  obligations: readonly AssuranceEvidenceObligation[],
): AssuranceContradictoryEvidence[] {
  const contradictions: AssuranceContradictoryEvidence[] = [];
  for (const record of records) {
    for (const field of OBSERVATION_FIELDS) {
      for (const id of observationValues(record.observed, field)) {
        const matchingBehaviorIds = obligations
          .filter(({ observations }) =>
            observations.some(
              (observation) => observation.field === field && observation.id === id,
            ),
          )
          .map(({ behaviorId }) => behaviorId);
        if (
          matchingBehaviorIds.length > 0 &&
          !matchingBehaviorIds.some((behaviorId) => record.intent.contractIds.includes(behaviorId))
        ) {
          const observation = { field, id };
          contradictions.push({
            status: "contradictory",
            evidenceId: record.id,
            observation,
            recoveryAction: `Declare one matching intent (${matchingBehaviorIds.map((value) => `'${value}'`).join(", ")}) and assert the observed outcome; observation alone is insufficient.`,
          });
        }
      }
    }
  }
  return contradictions;
}

function appendAssessmentSection(
  lines: string[],
  title: string,
  assessments: readonly AssuranceObligationAssessment[],
): void {
  lines.push(`## ${title}`, "");
  if (assessments.length === 0) {
    lines.push("- None.", "");
    return;
  }
  for (const assessment of assessments) {
    const source = formatSource(assessment.obligation.source);
    lines.push(
      `- \`${assessment.obligation.id}\`${source}: ${assessment.obligation.description}`,
      ...assessment.reasons.map((reason) => `  - ${reason}`),
      `  - Recovery: \`${assessment.obligation.recovery.command}\``,
      `  - Template: ${assessment.obligation.recovery.testTemplate}`,
    );
  }
  lines.push("");
}

function appendStaleSection(lines: string[], stale: readonly AssuranceStaleEvidence[]): void {
  lines.push("## Stale", "");
  if (stale.length === 0) {
    lines.push("- None.", "");
    return;
  }
  for (const item of stale) {
    lines.push(
      `- \`${item.evidenceId}\` references unknown \`${item.unknownId}\` in \`${item.field}\`.`,
      `  - Recovery: ${item.recoveryAction}`,
    );
  }
  lines.push("");
}

function appendContradictorySection(
  lines: string[],
  contradictory: ExecutableAssuranceReport["contradictory"],
): void {
  const assessments = contradictory.filter(isObligationAssessment);
  appendAssessmentSection(lines, "Contradictory", assessments);
  for (const item of contradictory) {
    if (isObligationAssessment(item)) continue;
    lines.push(
      `- \`${item.evidenceId}\` observed \`${item.observation.field}:${item.observation.id}\` without matching declared intent.`,
      `  - Recovery: ${item.recoveryAction}`,
    );
  }
  if (contradictory.some((item) => !isObligationAssessment(item))) lines.push("");
}

function isObligationAssessment(
  value: AssuranceObligationAssessment | AssuranceContradictoryEvidence,
): value is AssuranceObligationAssessment {
  return "obligation" in value;
}

function compareContradictions(
  left: AssuranceObligationAssessment | AssuranceContradictoryEvidence,
  right: AssuranceObligationAssessment | AssuranceContradictoryEvidence,
): number {
  const leftId = isObligationAssessment(left)
    ? left.obligation.id
    : `${left.evidenceId}:${left.observation.field}:${left.observation.id}`;
  const rightId = isObligationAssessment(right)
    ? right.obligation.id
    : `${right.evidenceId}:${right.observation.field}:${right.observation.id}`;
  return compareStrings(leftId, rightId);
}

function behaviorId(kind: AssuranceBehaviorKind, id: string): string {
  assertNonEmpty(id, `${kind} behavior id`);
  return `${kind}:${id}`;
}

function runtimeFidelityRequirement(
  manifest: RuntimeCapabilityManifest | undefined,
): Partial<TestEvidenceFidelity> {
  if (!manifest) return {};
  if (manifest.platform === "node") return { runtime: "node" };
  if (manifest.platform === "lambda") return { runtime: "lambda" };
  if (manifest.platform === "cloudflare-workers") return { runtime: "cloudflare" };
  return {};
}

function responseContractId(nodeId: string): string {
  return `${nodeId}#response`;
}

function uniqueProjectMapProblems(
  projectMap: AssuranceProjectMapArtifact,
): readonly { readonly code: string; readonly source?: AssuranceSourceLocation | undefined }[] {
  const routeById = new Map(projectMap.routeGraph.routes.map((route) => [route.id, route]));
  const byCode = new Map<string, AssuranceSourceLocation | undefined>();
  for (const response of projectMap.problems.responses) {
    if (!byCode.has(response.code))
      byCode.set(response.code, routeById.get(response.routeId)?.source);
  }
  return [...byCode.entries()]
    .map(([code, source]) => ({ code, source }))
    .sort((left, right) => compareStrings(left.code, right.code));
}

function assertProjectMapRouteCompatible(
  contractRoute: ContractGraphSnapshot["routes"][number],
  projectRoute: AssuranceProjectMapArtifact["routeGraph"]["routes"][number],
  projectMap: AssuranceProjectMapArtifact,
): void {
  const contractProblems = uniqueStrings(contractRoute.problems.map(({ code }) => code));
  const projectProblems = uniqueStrings(
    projectMap.problems.responses
      .filter(({ routeId }) => routeId === projectRoute.id)
      .map(({ code }) => code),
  );
  if (
    contractRoute.httpMethod !== projectRoute.method ||
    contractRoute.path !== projectRoute.path ||
    contractProblems.join("\0") !== projectProblems.join("\0")
  ) {
    throw new ExecutableAssuranceContractProblem(
      `Contract Graph and Project Map disagree for route '${projectRoute.id}'.`,
    );
  }
}

function assertMinimumFidelity(value: Readonly<Record<string, unknown>>, index: number): void {
  for (const [field, expected] of Object.entries(value)) {
    const allowed = FIDELITY_VALUES[field as keyof TestEvidenceFidelity];
    if (!allowed || !allowed.includes(expected as never)) {
      throw new ExecutableAssuranceContractProblem(
        `Graph obligations[${index}] minimumFidelity ${field} is unsupported.`,
      );
    }
  }
}

function publicApiEntrypointId(packageName: string, exportPath: string): string {
  return exportPath === "." ? packageName : `${packageName}${exportPath.slice(1)}`;
}

function isAssuranceId(id: string): boolean {
  return ASSURANCE_PREFIXES.some((prefix) => id.startsWith(prefix));
}

function isProblemCodeRegistry(
  registry: ProblemRegistrySnapshot | ProblemCodeRegistry,
): registry is ProblemCodeRegistry {
  return "version" in registry;
}

function toSource(
  source:
    | FrameworkManifestSourceLocation
    | { readonly path: string; readonly line?: number; readonly column?: number }
    | null
    | undefined,
): AssuranceSourceLocation | undefined {
  if (!source) return undefined;
  return {
    path: source.path,
    ...(source.line === undefined ? {} : { line: source.line }),
    ...(source.column === undefined ? {} : { column: source.column }),
  };
}

function routeRecovery(routeId: string): AssuranceRecovery {
  return {
    command: `pnpm test -- -t "${routeId}"`,
    testTemplate: `Declare intent 'route:${routeId}', invoke the application-fidelity route, and assert its response.`,
  };
}

function problemRecovery(code: string, behavior?: string): AssuranceRecovery {
  return {
    command: `pnpm test -- -t "${code}"`,
    testTemplate: `Declare intent '${behavior ?? `problem:${code}`}', trigger '${code}', and assert the returned Problem.`,
  };
}

function genericRecovery(kind: AssuranceBehaviorKind, id: string): AssuranceRecovery {
  return {
    command: `pnpm test -- -t "${id}"`,
    testTemplate: `Declare intent '${kind}:${id}', execute the public behavior, and assert its runtime observation and outcome.`,
  };
}

function formatSource(source?: AssuranceSourceLocation): string {
  if (!source) return "";
  return ` (${source.path}${source.line === undefined ? "" : `:${source.line}`})`;
}

function compareObservations(
  left: AssuranceObservationRequirement,
  right: AssuranceObservationRequirement,
): number {
  return compareStrings(`${left.field}\0${left.id}`, `${right.field}\0${right.id}`);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function assertUnique(values: readonly string[], label: string): void {
  const duplicate = values.find((value, index) => values.indexOf(value) !== index);
  if (duplicate) throw new ExecutableAssuranceContractProblem(`Duplicate ${label} '${duplicate}'.`);
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new ExecutableAssuranceContractProblem(`${label} must be non-empty.`);
  }
}

function assertNonEmptyValue(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") {
    throw new ExecutableAssuranceContractProblem(`${label} must be a string.`);
  }
  assertNonEmpty(value, label);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([key, nested]) => [key, canonicalizeJson(nested)]),
  );
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

const ASSURANCE_PREFIXES = [
  "route:",
  "rpc:",
  "problem:",
  "event:",
  "event-handler:",
  "task:",
  "provider:",
  "journey:",
  "public-api:",
  "runtime:",
  "provider-profile:",
] as const;

const FIDELITY_VALUES: {
  readonly [Field in keyof TestEvidenceFidelity]: readonly TestEvidenceFidelity[Field][];
} = {
  boot: ["isolated", "application", "adapter"],
  dependency: ["fake", "local-real", "remote-real"],
  isolation: ["fake", "rollback", "commit", "migration"],
  runtime: ["node", "lambda", "cloudflare", "browser"],
  validation: ["isolated", "production", "overridden"],
};
const BEHAVIOR_KINDS: readonly AssuranceBehaviorKind[] = [
  "route",
  "rpc",
  "problem",
  "event",
  "event-handler",
  "task",
  "provider",
  "journey",
  "public-api",
  "runtime",
  "provider-profile",
];
const OBSERVATION_FIELDS: readonly AssuranceObservationField[] = [
  "contractIds",
  "routeIds",
  "problemCodes",
  "eventIds",
  "taskIds",
  "spanIds",
  "providerIds",
];
