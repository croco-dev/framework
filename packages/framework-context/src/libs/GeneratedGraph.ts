import type { TokenIdentifier } from "./Token";
import type { DependencySourceLocation, Scope } from "./types";

export const GENERATED_DI_GRAPH_VERSION = "croco.generated-di-graph.v1" as const;

export type GeneratedProviderDependency = {
  readonly token: TokenIdentifier<unknown>;
  readonly tokenId: string;
  readonly many?: boolean;
  readonly optional?: boolean;
  readonly parameterIndex?: number;
  readonly propertyKey?: string;
  readonly sourceLocation?: DependencySourceLocation;
};

export type GeneratedProviderResolver = {
  readonly get: <T>(token: TokenIdentifier<T>) => T;
  readonly getMany: <T>(token: TokenIdentifier<T>) => readonly T[];
  readonly getOptional: <T>(token: TokenIdentifier<T>) => T | undefined;
};

export type GeneratedProviderKind = "component" | "rest-controller" | "graphql-resolver";

export type GeneratedProviderDefinition<T = unknown> = {
  readonly token: TokenIdentifier<T>;
  readonly tokenId: string;
  readonly debugName: string;
  readonly kind?: GeneratedProviderKind;
  readonly scope: Scope;
  readonly dependencies: readonly GeneratedProviderDependency[];
  readonly factory: (resolver: GeneratedProviderResolver) => T;
  readonly multiple?: boolean;
  readonly moduleName?: string;
  readonly sourceLocation: DependencySourceLocation;
};

export type GeneratedModuleProviderDeclaration = {
  readonly token: TokenIdentifier<unknown>;
  readonly tokenId: string;
  readonly moduleName: string;
  readonly scope: Scope;
  readonly sourceLocation: DependencySourceLocation;
};

export type GeneratedDiGraph = {
  readonly version: typeof GENERATED_DI_GRAPH_VERSION;
  readonly graphId: string;
  readonly compilerVersion: string;
  readonly inputHash: string;
  readonly providers: readonly GeneratedProviderDefinition[];
  readonly moduleProviders?: readonly GeneratedModuleProviderDeclaration[];
  readonly roots: readonly TokenIdentifier<unknown>[];
};

export function defineGeneratedDiGraph(graph: GeneratedDiGraph): GeneratedDiGraph {
  return Object.freeze({
    ...graph,
    providers: Object.freeze([...graph.providers]),
    ...(graph.moduleProviders
      ? { moduleProviders: Object.freeze([...graph.moduleProviders]) }
      : {}),
    roots: Object.freeze([...graph.roots]),
  });
}
