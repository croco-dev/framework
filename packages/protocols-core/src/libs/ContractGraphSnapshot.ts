import type { z } from "zod";
import type {
  ContractAccessMetadata,
  ContractDiagnostic,
  ContractEntitlementRequirement,
  ContractGraph,
  ContractGraphRoute,
  ContractGraphVersion,
  ContractMetadataReference,
} from "./ContractGraph";
import {
  createContractGraphConsumerCoverage,
  type ContractGraphConsumerCoverageReport,
} from "./ContractGraphConsumerCoverage";
import type { ParamIR } from "./RouteIR";
import { describeZodSchema } from "./SchemaDescriptor";
import type { ContractSchemaDescriptor, ContractSchemaFieldDescriptor } from "./SchemaDescriptor";

export type ContractGraphSnapshotVersion = "croco.contract-graph.snapshot.v1";
export type ContractSchemaLocation = "body" | "path" | "query" | "headers" | "response" | "problem";

export type ContractSchemaSnapshot = ContractSchemaDescriptor;
export type ContractSchemaFieldSnapshot = ContractSchemaFieldDescriptor;

export type ContractGraphSnapshotController = {
  readonly name: string;
  readonly path: string;
  readonly guards: readonly ContractMetadataReference[];
  readonly roles: readonly string[];
  readonly routeIds: readonly string[];
};

export type ContractGraphSnapshotParam = {
  readonly kind: ParamIR["kind"];
  readonly name: string;
  readonly schema: ContractSchemaSnapshot | null;
};

export type ContractGraphSnapshotProblemResponse = {
  readonly code: string;
  readonly category: string;
  readonly status: number;
  readonly cookbookPath?: string;
  readonly description?: string;
  readonly type?: string;
};

export type ContractGraphSnapshotRouteContract = {
  readonly id: string | null;
  readonly method: string;
  readonly path: string;
  readonly operationId?: string;
  readonly sourceLocation?: {
    readonly path: string;
    readonly line?: number;
    readonly column?: number;
  };
};

export type ContractGraphSnapshotEntitlementRequirement = ContractEntitlementRequirement;

export type ContractGraphSnapshotRoute = {
  readonly routeId: string;
  readonly operationId: string;
  readonly controllerName: string;
  readonly methodName: string;
  readonly httpMethod: string;
  readonly path: string;
  readonly controllerPath: string;
  readonly domain: string | null;
  readonly routeContract: ContractGraphSnapshotRouteContract | null;
  readonly access: ContractAccessMetadata;
  readonly entitlements: readonly ContractGraphSnapshotEntitlementRequirement[];
  readonly params: readonly ContractGraphSnapshotParam[];
  readonly request: {
    readonly body: ContractSchemaSnapshot | null;
    readonly path: ContractSchemaSnapshot | null;
    readonly query: ContractSchemaSnapshot | null;
    readonly headers: ContractSchemaSnapshot | null;
  };
  readonly response: ContractSchemaSnapshot | null;
  readonly problems: readonly ContractGraphSnapshotProblemResponse[];
};

export type ContractGraphSnapshot = {
  readonly snapshotVersion: ContractGraphSnapshotVersion;
  readonly graphVersion: ContractGraphVersion;
  readonly controllerCount: number;
  readonly routeCount: number;
  readonly operationIds: readonly string[];
  readonly consumerCoverage?: ContractGraphConsumerCoverageReport;
  readonly controllers: readonly ContractGraphSnapshotController[];
  readonly routes: readonly ContractGraphSnapshotRoute[];
  readonly diagnostics: readonly ContractDiagnostic[];
};

export function createContractGraphSnapshot(graph: ContractGraph): ContractGraphSnapshot {
  const controllers = [...graph.controllers]
    .map((controller) => ({
      name: controller.name,
      path: controller.path,
      guards: sortGuards(controller.guards),
      roles: [...controller.roles].sort(compareStrings),
      routeIds: [...controller.routeIds].sort(compareStrings),
    }))
    .sort(compareControllers);
  const routes = graph.routes.map(toSnapshotRoute).sort(compareRoutes);

  return {
    snapshotVersion: "croco.contract-graph.snapshot.v1",
    graphVersion: graph.version,
    controllerCount: controllers.length,
    routeCount: routes.length,
    operationIds: routes.map((route) => route.operationId).sort(compareStrings),
    consumerCoverage: createContractGraphConsumerCoverage(graph),
    controllers,
    routes,
    diagnostics: [...graph.diagnostics].sort(compareDiagnostics),
  };
}

export function stringifyContractGraphSnapshot(snapshot: ContractGraphSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function isContractGraphSnapshot(value: unknown): value is ContractGraphSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value["snapshotVersion"] === "croco.contract-graph.snapshot.v1" &&
    value["graphVersion"] === "croco.contract-graph.v1" &&
    Array.isArray(value["controllers"]) &&
    Array.isArray(value["routes"]) &&
    Array.isArray(value["diagnostics"])
  );
}

export function snapshotZodSchema(
  schema: z.ZodType | null | undefined,
): ContractSchemaSnapshot | null {
  return describeZodSchema(schema);
}

function toSnapshotRoute(route: ContractGraphRoute): ContractGraphSnapshotRoute {
  return {
    routeId: route.routeId,
    operationId: route.operationId,
    controllerName: route.controllerName,
    methodName: route.methodName,
    httpMethod: route.httpMethod.toUpperCase(),
    path: route.path,
    controllerPath: route.controllerPath,
    domain: route.domain,
    routeContract: route.routeContract
      ? {
          id: route.routeContract.id,
          method: route.routeContract.method,
          path: route.routeContract.path,
          ...(route.routeContract.operationId
            ? { operationId: route.routeContract.operationId }
            : {}),
          ...(route.routeContract.sourceLocation
            ? { sourceLocation: route.routeContract.sourceLocation }
            : {}),
        }
      : null,
    access: {
      guards: sortGuards(route.access.guards),
      roles: [...route.access.roles].sort(compareStrings),
    },
    entitlements: sortEntitlements(route.entitlements),
    params: route.params.map((param) => ({
      kind: param.kind,
      name: param.name,
      schema: snapshotZodSchema(param.schema),
    })),
    request: {
      body: snapshotZodSchema(route.inputSchemas.body),
      path: snapshotZodSchema(route.inputSchemas.path),
      query: snapshotZodSchema(route.inputSchemas.query),
      headers: snapshotZodSchema(route.inputSchemas.headers),
    },
    response: snapshotZodSchema(route.outputSchema),
    problems: [...(route.problemResponses ?? [])]
      .map((problem) => ({
        code: problem.code,
        category: problem.category,
        status: problem.status,
        ...(problem.cookbookPath ? { cookbookPath: problem.cookbookPath } : {}),
        ...(problem.description ? { description: problem.description } : {}),
        ...(problem.type ? { type: problem.type } : {}),
      }))
      .sort(compareProblemResponses),
  };
}

function compareProblemResponses(
  left: ContractGraphSnapshotProblemResponse,
  right: ContractGraphSnapshotProblemResponse,
): number {
  return compareStrings(left.code, right.code) || left.status - right.status;
}

function sortGuards(
  guards: readonly ContractMetadataReference[],
): readonly ContractMetadataReference[] {
  return [...guards].sort((left, right) => compareStrings(left.id, right.id));
}

function sortEntitlements(
  entitlements: readonly ContractEntitlementRequirement[],
): readonly ContractEntitlementRequirement[] {
  return [...entitlements].sort(compareEntitlements);
}

function compareEntitlements(
  left: ContractEntitlementRequirement,
  right: ContractEntitlementRequirement,
): number {
  return compareStrings(entitlementFingerprint(left), entitlementFingerprint(right));
}

function entitlementFingerprint(entitlement: ContractEntitlementRequirement): string {
  return JSON.stringify({
    feature: entitlement.feature,
    description: entitlement.description,
    resource: entitlement.resource,
  });
}

function compareControllers(
  left: ContractGraphSnapshotController,
  right: ContractGraphSnapshotController,
): number {
  return compareStrings(left.name, right.name) || compareStrings(left.path, right.path);
}

function compareRoutes(
  left: ContractGraphSnapshotRoute,
  right: ContractGraphSnapshotRoute,
): number {
  return (
    compareStrings(left.routeId, right.routeId) ||
    compareStrings(left.httpMethod, right.httpMethod) ||
    compareStrings(left.path, right.path)
  );
}

function compareDiagnostics(left: ContractDiagnostic, right: ContractDiagnostic): number {
  return (
    compareStrings(left.severity, right.severity) ||
    compareStrings(left.code, right.code) ||
    compareStrings(left.routeId ?? "", right.routeId ?? "") ||
    compareStrings(left.controllerName ?? "", right.controllerName ?? "") ||
    compareStrings(left.message, right.message)
  );
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
