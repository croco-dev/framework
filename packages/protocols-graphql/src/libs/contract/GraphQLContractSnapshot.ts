import "reflect-metadata";
import type { Scope } from "@croco/framework-context";
import type { ProblemCategory } from "@croco/problems-core";
import type { GraphQLField, GraphQLObjectType, GraphQLSchema, GraphQLType } from "graphql";
import { lexicographicSortSchema, printSchema } from "graphql";
import { getMetadataStorage } from "type-graphql";
import {
  GRAPHQL_GUARDS_KEY,
  GRAPHQL_INTERCEPTORS_KEY,
  GRAPHQL_PROBLEM_RESPONSES_KEY,
  GRAPHQL_ROLES_KEY,
} from "../constants";
import { getAllResolvers, getResolverMetadata } from "../metadata/MetadataReader";
import type { GraphQLProblemResponseMetadata } from "../decorators/GraphQLProblemResponse";

export type GraphQLContractSnapshotVersion = "croco.graphql-contract.snapshot.v1";
export type GraphQLContractOperationKind = "query" | "mutation" | "subscription";

export type GraphQLContractSnapshotOptions = {
  readonly resolvers?: readonly Function[];
};

export type GraphQLContractSnapshotArgument = {
  readonly name: string;
  readonly type: string;
  readonly defaultValue?: string;
  readonly description?: string;
};

export type GraphQLContractSnapshotOperation = {
  readonly kind: GraphQLContractOperationKind;
  readonly name: string;
  readonly type: string;
  readonly args: readonly GraphQLContractSnapshotArgument[];
  readonly description?: string;
  readonly deprecationReason?: string;
};

export type GraphQLContractSnapshotProblemResponse = {
  readonly code: string;
  readonly category: ProblemCategory;
  readonly status: number;
  readonly description?: string;
  readonly type?: string;
};

export type GraphQLContractSnapshotResolverMethod = {
  readonly methodName: string;
  readonly guards: readonly string[];
  readonly interceptors: readonly string[];
  readonly roles: readonly string[];
  readonly problems: readonly GraphQLContractSnapshotProblemResponse[];
};

export type GraphQLContractSnapshotResolver = {
  readonly resolverName: string;
  readonly diScope: Scope | null;
  readonly methods: readonly GraphQLContractSnapshotResolverMethod[];
};

export type GraphQLContractSnapshotDiagnostic = {
  readonly code: string;
  readonly message: string;
  readonly resolverName?: string;
  readonly operationName?: string;
};

export type GraphQLContractSnapshot = {
  readonly snapshotVersion: GraphQLContractSnapshotVersion;
  readonly sdl: string;
  readonly operationCount: number;
  readonly resolverCount: number;
  readonly operations: readonly GraphQLContractSnapshotOperation[];
  readonly resolvers: readonly GraphQLContractSnapshotResolver[];
  readonly diagnostics: readonly GraphQLContractSnapshotDiagnostic[];
};

type TypeGraphQLResolverMethodMetadata = {
  readonly target: Function;
  readonly methodName: string;
};

export function createGraphQLContractSnapshot(
  schema: GraphQLSchema,
  options: GraphQLContractSnapshotOptions = {},
): GraphQLContractSnapshot {
  const sortedSchema = lexicographicSortSchema(schema);
  const operations = collectOperations(sortedSchema);
  const resolvers = collectResolvers(options.resolvers ?? getAllResolvers());

  return {
    snapshotVersion: "croco.graphql-contract.snapshot.v1",
    sdl: `${printSchema(sortedSchema).trim()}\n`,
    operationCount: operations.length,
    resolverCount: resolvers.length,
    operations,
    resolvers,
    diagnostics: [],
  };
}

export function stringifyGraphQLContractSnapshot(snapshot: GraphQLContractSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function isGraphQLContractSnapshot(value: unknown): value is GraphQLContractSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value["snapshotVersion"] === "croco.graphql-contract.snapshot.v1" &&
    typeof value["sdl"] === "string" &&
    Array.isArray(value["operations"]) &&
    Array.isArray(value["resolvers"]) &&
    Array.isArray(value["diagnostics"])
  );
}

function collectOperations(schema: GraphQLSchema): GraphQLContractSnapshotOperation[] {
  return [
    ...collectRootOperations("query", schema.getQueryType()),
    ...collectRootOperations("mutation", schema.getMutationType()),
    ...collectRootOperations("subscription", schema.getSubscriptionType()),
  ].sort(compareOperations);
}

function collectRootOperations(
  kind: GraphQLContractOperationKind,
  rootType: GraphQLObjectType | null | undefined,
): GraphQLContractSnapshotOperation[] {
  if (!rootType) {
    return [];
  }

  return Object.values(rootType.getFields()).map((field) => toOperation(kind, field));
}

function toOperation(
  kind: GraphQLContractOperationKind,
  field: GraphQLField<unknown, unknown>,
): GraphQLContractSnapshotOperation {
  return {
    kind,
    name: field.name,
    type: printGraphQLType(field.type),
    args: field.args
      .map((arg) => ({
        name: arg.name,
        type: printGraphQLType(arg.type),
        ...(stringifyDefaultValue(arg.defaultValue) !== undefined
          ? { defaultValue: stringifyDefaultValue(arg.defaultValue) }
          : {}),
        ...(arg.description ? { description: arg.description } : {}),
      }))
      .sort(compareArguments),
    ...(field.description ? { description: field.description } : {}),
    ...(field.deprecationReason ? { deprecationReason: field.deprecationReason } : {}),
  };
}

function collectResolvers(resolvers: readonly Function[]): GraphQLContractSnapshotResolver[] {
  return [...resolvers].map(toResolverSnapshot).sort(compareResolvers);
}

function toResolverSnapshot(resolver: Function): GraphQLContractSnapshotResolver {
  const metadata = getResolverMetadata(resolver);
  const resolverName = resolver.name || "AnonymousResolver";
  const prototype = resolver.prototype as object | undefined;
  const methodNames = prototype ? collectMethodNames(resolver, prototype) : [];

  return {
    resolverName,
    diScope: metadata?.scope ?? null,
    methods: methodNames
      .map((methodName) => toResolverMethodSnapshot(resolver, methodName))
      .sort(compareResolverMethods),
  };
}

function collectMethodNames(resolver: Function, prototype: object): string[] {
  const graphQLMethodNames = collectGraphQLMethodNames(resolver);

  return Object.getOwnPropertyNames(prototype).filter((methodName) => {
    if (methodName === "constructor") {
      return false;
    }

    const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);

    return (
      typeof descriptor?.value === "function" &&
      (graphQLMethodNames.has(methodName) ||
        hasCrocoContractMethodMetadata(resolver, prototype, methodName))
    );
  });
}

function collectGraphQLMethodNames(resolver: Function): ReadonlySet<string> {
  const storage = getMetadataStorage();
  const methods = [
    ...storage.queries,
    ...storage.mutations,
    ...storage.subscriptions,
    ...storage.fieldResolvers,
  ];

  return new Set(
    methods
      .filter(isTypeGraphQLResolverMethodMetadata)
      .filter((method) => method.target === resolver)
      .map((method) => method.methodName),
  );
}

function isTypeGraphQLResolverMethodMetadata(
  value: unknown,
): value is TypeGraphQLResolverMethodMetadata {
  return (
    isRecord(value) &&
    typeof value["target"] === "function" &&
    typeof value["methodName"] === "string"
  );
}

function hasCrocoContractMethodMetadata(
  resolver: Function,
  prototype: object,
  methodName: string,
): boolean {
  return (
    Reflect.hasMetadata(GRAPHQL_GUARDS_KEY, prototype, methodName) ||
    Reflect.hasMetadata(GRAPHQL_INTERCEPTORS_KEY, prototype, methodName) ||
    Reflect.hasMetadata(GRAPHQL_ROLES_KEY, prototype, methodName) ||
    Reflect.hasMetadata(GRAPHQL_PROBLEM_RESPONSES_KEY, resolver, methodName)
  );
}

function toResolverMethodSnapshot(
  resolver: Function,
  methodName: string,
): GraphQLContractSnapshotResolverMethod {
  const prototype = resolver.prototype as object;

  return {
    methodName,
    guards: readReferenceMetadata(GRAPHQL_GUARDS_KEY, prototype, methodName),
    interceptors: readReferenceMetadata(GRAPHQL_INTERCEPTORS_KEY, prototype, methodName),
    roles: readStringMetadata(GRAPHQL_ROLES_KEY, prototype, methodName),
    problems: readProblemResponses(resolver, methodName),
  };
}

function readReferenceMetadata(key: symbol, target: object, methodName: string): string[] {
  const value = Reflect.getMetadata(key, target, methodName);

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(toReferenceName).sort(compareStrings);
}

function readStringMetadata(key: symbol, target: object, methodName: string): string[] {
  const value = Reflect.getMetadata(key, target, methodName);

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string").sort(compareStrings);
}

function readProblemResponses(
  resolver: Function,
  methodName: string,
): GraphQLContractSnapshotProblemResponse[] {
  const value = Reflect.getMetadata(GRAPHQL_PROBLEM_RESPONSES_KEY, resolver, methodName);

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isProblemResponseMetadata)
    .map((problem) => ({
      code: problem.code,
      category: problem.category,
      status: problem.status,
      ...(problem.description ? { description: problem.description } : {}),
      ...(problem.type ? { type: problem.type } : {}),
    }))
    .sort(compareProblemResponses);
}

function isProblemResponseMetadata(value: unknown): value is GraphQLProblemResponseMetadata {
  return (
    isRecord(value) &&
    typeof value["code"] === "string" &&
    typeof value["category"] === "string" &&
    typeof value["status"] === "number"
  );
}

function toReferenceName(value: unknown): string {
  if (typeof value === "function") {
    return value.name || "anonymous";
  }

  if (isRecord(value) && typeof value["name"] === "string") {
    return value["name"];
  }

  if (isRecord(value) && typeof value["constructor"] === "function") {
    return value["constructor"].name || "anonymous";
  }

  return String(value);
}

function stringifyDefaultValue(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function printGraphQLType(type: GraphQLType): string {
  return String(type);
}

function compareOperations(
  left: GraphQLContractSnapshotOperation,
  right: GraphQLContractSnapshotOperation,
): number {
  return compareStrings(left.kind, right.kind) || compareStrings(left.name, right.name);
}

function compareArguments(
  left: GraphQLContractSnapshotArgument,
  right: GraphQLContractSnapshotArgument,
): number {
  return compareStrings(left.name, right.name);
}

function compareResolvers(
  left: GraphQLContractSnapshotResolver,
  right: GraphQLContractSnapshotResolver,
): number {
  return compareStrings(left.resolverName, right.resolverName);
}

function compareResolverMethods(
  left: GraphQLContractSnapshotResolverMethod,
  right: GraphQLContractSnapshotResolverMethod,
): number {
  return compareStrings(left.methodName, right.methodName);
}

function compareProblemResponses(
  left: GraphQLContractSnapshotProblemResponse,
  right: GraphQLContractSnapshotProblemResponse,
): number {
  return compareStrings(left.code, right.code) || left.status - right.status;
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
