import { buildSchema, findBreakingChanges, findDangerousChanges } from "graphql";
import type {
  GraphQLContractSnapshot,
  GraphQLContractSnapshotOperation,
  GraphQLContractSnapshotProblemResponse,
  GraphQLContractSnapshotResolver,
  GraphQLContractSnapshotResolverMethod,
} from "./GraphQLContractSnapshot";

export type GraphQLContractDiffSeverity = "breaking" | "non-breaking";

export type GraphQLContractDiffChange = {
  readonly code: string;
  readonly severity: GraphQLContractDiffSeverity;
  readonly message: string;
  readonly operationName?: string;
  readonly resolverName?: string;
  readonly methodName?: string;
  readonly fieldPath?: string;
};

export type GraphQLContractDiff = {
  readonly baselineOperationCount: number;
  readonly currentOperationCount: number;
  readonly baselineResolverCount: number;
  readonly currentResolverCount: number;
  readonly breakingChangeCount: number;
  readonly nonBreakingChangeCount: number;
  readonly hasBreakingChanges: boolean;
  readonly changes: readonly GraphQLContractDiffChange[];
  readonly breakingChanges: readonly GraphQLContractDiffChange[];
  readonly nonBreakingChanges: readonly GraphQLContractDiffChange[];
};

export function diffGraphQLContractSnapshots(
  baseline: GraphQLContractSnapshot,
  current: GraphQLContractSnapshot,
): GraphQLContractDiff {
  const changes = [
    ...diffSchema(baseline, current),
    ...diffOperations(baseline, current),
    ...diffResolvers(baseline, current),
  ].sort(compareChanges);
  const breakingChanges = changes.filter((change) => change.severity === "breaking");
  const nonBreakingChanges = changes.filter((change) => change.severity === "non-breaking");

  return {
    baselineOperationCount: baseline.operationCount,
    currentOperationCount: current.operationCount,
    baselineResolverCount: baseline.resolverCount,
    currentResolverCount: current.resolverCount,
    breakingChangeCount: breakingChanges.length,
    nonBreakingChangeCount: nonBreakingChanges.length,
    hasBreakingChanges: breakingChanges.length > 0,
    changes,
    breakingChanges,
    nonBreakingChanges,
  };
}

function diffSchema(
  baseline: GraphQLContractSnapshot,
  current: GraphQLContractSnapshot,
): GraphQLContractDiffChange[] {
  const baselineSchema = buildSchema(baseline.sdl);
  const currentSchema = buildSchema(current.sdl);

  return [
    ...findBreakingChanges(baselineSchema, currentSchema).map((change) => ({
      code: "graphql-schema-breaking-change",
      severity: "breaking" as const,
      fieldPath: change.type,
      message: change.description,
    })),
    ...findDangerousChanges(baselineSchema, currentSchema).map((change) => ({
      code: "graphql-schema-dangerous-change",
      severity: "non-breaking" as const,
      fieldPath: change.type,
      message: change.description,
    })),
  ];
}

function diffOperations(
  baseline: GraphQLContractSnapshot,
  current: GraphQLContractSnapshot,
): GraphQLContractDiffChange[] {
  const changes: GraphQLContractDiffChange[] = [];
  const baselineOperations = new Map(
    baseline.operations.map((operation) => [operationKey(operation), operation]),
  );
  const currentOperations = new Map(
    current.operations.map((operation) => [operationKey(operation), operation]),
  );

  for (const baselineOperation of baseline.operations) {
    const key = operationKey(baselineOperation);

    if (!currentOperations.has(key)) {
      changes.push({
        code: "graphql-operation-removed",
        severity: "breaking",
        operationName: baselineOperation.name,
        message: `${baselineOperation.kind} operation '${baselineOperation.name}' was removed from the GraphQL contract.`,
      });
    }
  }

  for (const currentOperation of current.operations) {
    const key = operationKey(currentOperation);

    if (!baselineOperations.has(key)) {
      changes.push({
        code: "graphql-operation-added",
        severity: "non-breaking",
        operationName: currentOperation.name,
        message: `${currentOperation.kind} operation '${currentOperation.name}' was added to the GraphQL contract.`,
      });
    }
  }

  return changes;
}

function diffResolvers(
  baseline: GraphQLContractSnapshot,
  current: GraphQLContractSnapshot,
): GraphQLContractDiffChange[] {
  const changes: GraphQLContractDiffChange[] = [];
  const baselineResolvers = new Map(
    baseline.resolvers.map((resolver) => [resolver.resolverName, resolver]),
  );
  const currentResolvers = new Map(
    current.resolvers.map((resolver) => [resolver.resolverName, resolver]),
  );

  for (const baselineResolver of baseline.resolvers) {
    const currentResolver = currentResolvers.get(baselineResolver.resolverName);

    if (!currentResolver) {
      changes.push({
        code: "graphql-resolver-removed",
        severity: "breaking",
        resolverName: baselineResolver.resolverName,
        message: `Resolver '${baselineResolver.resolverName}' was removed from the GraphQL contract metadata.`,
      });
      continue;
    }

    changes.push(...diffExistingResolver(baselineResolver, currentResolver));
  }

  for (const currentResolver of current.resolvers) {
    if (!baselineResolvers.has(currentResolver.resolverName)) {
      changes.push({
        code: "graphql-resolver-added",
        severity: "non-breaking",
        resolverName: currentResolver.resolverName,
        message: `Resolver '${currentResolver.resolverName}' was added to the GraphQL contract metadata.`,
      });
    }
  }

  return changes;
}

function diffExistingResolver(
  baseline: GraphQLContractSnapshotResolver,
  current: GraphQLContractSnapshotResolver,
): GraphQLContractDiffChange[] {
  const changes: GraphQLContractDiffChange[] = [];
  const baselineMethods = new Map(baseline.methods.map((method) => [method.methodName, method]));
  const currentMethods = new Map(current.methods.map((method) => [method.methodName, method]));

  if (baseline.diScope !== current.diScope) {
    changes.push({
      code: "graphql-resolver-di-scope-changed",
      severity: "breaking",
      resolverName: baseline.resolverName,
      message: `Resolver '${baseline.resolverName}' changed DI scope from '${baseline.diScope ?? "none"}' to '${current.diScope ?? "none"}'.`,
    });
  }

  for (const baselineMethod of baseline.methods) {
    const currentMethod = currentMethods.get(baselineMethod.methodName);

    if (!currentMethod) {
      changes.push({
        code: "graphql-resolver-method-removed",
        severity: "breaking",
        resolverName: baseline.resolverName,
        methodName: baselineMethod.methodName,
        message: `Resolver '${baseline.resolverName}' method '${baselineMethod.methodName}' was removed from contract metadata.`,
      });
      continue;
    }

    changes.push(...diffResolverMethod(baseline.resolverName, baselineMethod, currentMethod));
  }

  for (const currentMethod of current.methods) {
    if (!baselineMethods.has(currentMethod.methodName)) {
      changes.push({
        code: "graphql-resolver-method-added",
        severity: "non-breaking",
        resolverName: baseline.resolverName,
        methodName: currentMethod.methodName,
        message: `Resolver '${baseline.resolverName}' method '${currentMethod.methodName}' was added to contract metadata.`,
      });
    }
  }

  return changes;
}

function diffResolverMethod(
  resolverName: string,
  baseline: GraphQLContractSnapshotResolverMethod,
  current: GraphQLContractSnapshotResolverMethod,
): GraphQLContractDiffChange[] {
  const changes: GraphQLContractDiffChange[] = [];

  changes.push(
    ...diffStringList("guards", resolverName, baseline.methodName, baseline.guards, current.guards),
    ...diffStringList(
      "interceptors",
      resolverName,
      baseline.methodName,
      baseline.interceptors,
      current.interceptors,
    ),
    ...diffStringList("roles", resolverName, baseline.methodName, baseline.roles, current.roles),
    ...diffProblems(resolverName, baseline.methodName, baseline.problems, current.problems),
  );

  return changes;
}

function diffStringList(
  fieldName: "guards" | "interceptors" | "roles",
  resolverName: string,
  methodName: string,
  baseline: readonly string[],
  current: readonly string[],
): GraphQLContractDiffChange[] {
  if (fingerprint(baseline) === fingerprint(current)) {
    return [];
  }

  return [
    {
      code: `graphql-resolver-${fieldName}-changed`,
      severity: "breaking",
      resolverName,
      methodName,
      fieldPath: fieldName,
      message: `Resolver '${resolverName}' method '${methodName}' changed ${fieldName} metadata.`,
    },
  ];
}

function diffProblems(
  resolverName: string,
  methodName: string,
  baseline: readonly GraphQLContractSnapshotProblemResponse[],
  current: readonly GraphQLContractSnapshotProblemResponse[],
): GraphQLContractDiffChange[] {
  if (fingerprint(baseline) === fingerprint(current)) {
    return [];
  }

  return [
    {
      code: "graphql-resolver-problems-changed",
      severity: "breaking",
      resolverName,
      methodName,
      fieldPath: "problems",
      message: `Resolver '${resolverName}' method '${methodName}' changed declared GraphQL Problem mappings.`,
    },
  ];
}

function operationKey(operation: GraphQLContractSnapshotOperation): string {
  return `${operation.kind}:${operation.name}`;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(value);
}

function compareChanges(left: GraphQLContractDiffChange, right: GraphQLContractDiffChange): number {
  return (
    compareStrings(left.severity, right.severity) ||
    compareStrings(left.code, right.code) ||
    compareStrings(left.resolverName ?? "", right.resolverName ?? "") ||
    compareStrings(left.methodName ?? "", right.methodName ?? "") ||
    compareStrings(left.operationName ?? "", right.operationName ?? "") ||
    compareStrings(left.message, right.message)
  );
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}
