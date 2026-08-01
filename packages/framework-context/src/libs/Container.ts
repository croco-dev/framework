import { AsyncLocalStorage } from "node:async_hooks";
import {
  type Service,
  type ServiceIdentifier,
  Container as TypeDIContainer,
  ContainerInstance as TypeDIContainerInstance,
  ServiceNotFoundError,
  Token as TypeDIToken,
} from "typedi";
import type { Constructable as TypeDIConstructable } from "typedi/types/types/constructable.type";
import "reflect-metadata";
import { Problem, ProblemFactory } from "@croco/problems-core";
import { Context } from "./Context";
import { getParameterInjectionToken } from "./InjectionMetadata";
import { MetadataStorage } from "./MetadataStorage";
import { CircularDependencyProblem } from "./problems/CircularDependencyProblem";
import {
  ContainerResolutionProblem,
  ContainerScopeMismatchProblem,
} from "./problems/ContainerResolutionProblem";
import type {
  ComponentMetadata,
  Constructor,
  DependencyGraphDiagnostic,
  DependencyGraphManifest,
  DependencyGraphProvider,
  DependencyProviderKind,
  DependencyResolutionStep,
  DependencyResolutionStepStatus,
  DependencyResolutionTrace,
  DependencyResolutionTraceStatus,
  DependencySourceLocation,
  DependencyTokenKind,
  Scope,
} from "./types";

export type TokenIdentifier<T> = Constructor<T> | TypeDIToken<T> | string | symbol;
export type ContainerValidationOptions = {
  readonly force?: boolean;
};

const COMPONENT_METADATA_KEY = Symbol("component:metadata");
let containerScopeCounter = 0;

type ContainerScopeState = {
  readonly componentRegistrationOrder: Map<Constructor, number>;
  readonly componentSourceLocations: Map<Constructor, DependencySourceLocation>;
  readonly components: Map<Constructor, ComponentMetadata>;
  readonly explicitComponentSourceLocations: Map<Constructor, DependencySourceLocation>;
  readonly id: string;
  readonly instance: TypeDIContainerInstance;
  readonly lazyProviders: Map<TokenIdentifier<unknown>, () => unknown>;
  readonly tokenIdentityIds: Map<TokenIdentifier<unknown>, string>;
  readonly tokenIdentityOwners: Map<string, TokenIdentifier<unknown>>;
  readonly tokens: Set<TokenIdentifier<unknown>>;
  disposed: boolean;
  lastResolutionTrace?: DependencyResolutionTrace;
  nextComponentRegistrationOrder: number;
  validated: boolean;
};

const containerScopeStorage = new AsyncLocalStorage<ContainerScopeState>();

function createContainerScopeDisposedProblem(scopeId: string): Problem {
  return ProblemFactory.internalServerError(
    "framework-context/container-scope-disposed",
    `Container scope '${scopeId}' has already been disposed.`,
  );
}

/**
 * Owns an isolated DI runtime that can be entered across asynchronous bootstrap and request work.
 */
export class ContainerScope implements AsyncDisposable {
  readonly id: string;
  private readonly state: ContainerScopeState;

  constructor() {
    this.id = `croco-container-scope-${++containerScopeCounter}`;
    this.state = {
      componentRegistrationOrder: new Map(),
      componentSourceLocations: new Map(),
      components: new Map(),
      explicitComponentSourceLocations: new Map(),
      id: this.id,
      instance: TypeDIContainer.of(this.id),
      lazyProviders: new Map(),
      tokenIdentityIds: new Map(),
      tokenIdentityOwners: new Map(),
      tokens: new Set(),
      disposed: false,
      nextComponentRegistrationOrder: 1,
      validated: false,
    };
  }

  run<T>(fn: () => Promise<T>): Promise<T>;
  run<T>(fn: () => T): T;
  run<T>(fn: () => Promise<T> | T): Promise<T> | T {
    if (this.state.disposed) {
      throw createContainerScopeDisposedProblem(this.id);
    }

    return containerScopeStorage.run(this.state, fn);
  }

  dispose(): void {
    if (this.state.disposed) {
      return;
    }

    this.state.disposed = true;
    this.state.componentRegistrationOrder.clear();
    this.state.componentSourceLocations.clear();
    this.state.components.clear();
    this.state.explicitComponentSourceLocations.clear();
    this.state.lazyProviders.clear();
    this.state.tokenIdentityIds.clear();
    this.state.tokenIdentityOwners.clear();
    this.state.tokens.clear();
    delete this.state.lastResolutionTrace;
    this.state.instance.reset({ strategy: "resetServices" });
    TypeDIContainer.reset(this.id);
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    this.dispose();
  }
}

type HandlerDependencyResolver = <T>(id: Constructor<T> | TypeDIToken<T> | string) => T;

class HandlerContainerInstance extends TypeDIContainerInstance {
  constructor(
    id: string,
    private readonly resolveDependency: HandlerDependencyResolver,
  ) {
    super(id);
  }

  override get<T>(id: Constructor<T> | TypeDIToken<T> | string): T {
    return this.resolveDependency(id);
  }

  override getMany<T>(id: Constructor<T>): T[];
  override getMany<T>(id: TypeDIToken<T>): T[];
  override getMany<T>(id: string): T[];
  override getMany<T>(id: Constructor<T> | TypeDIToken<T> | string): T[] {
    if (typeof id === "function") {
      return [this.resolveDependency(id)];
    }

    if (typeof id === "string") {
      return TypeDIContainer.getMany(id);
    }

    return TypeDIContainer.getMany(id);
  }
}

/**
 * Croco 컴포넌트의 등록, 조회, 지연 생성, 요청 스코프 해석을 담당하는 DI 컨테이너입니다.
 */
export class Container {
  private static validated = false;
  private static readonly lazyProviders = new Map<TokenIdentifier<unknown>, () => unknown>();
  private static readonly symbolTokens = new Map<symbol, TypeDIToken<unknown>>();
  private static readonly componentSourceLocations = new Map<
    Constructor,
    DependencySourceLocation
  >();
  private static readonly explicitComponentSourceLocations = new Map<
    Constructor,
    DependencySourceLocation
  >();
  private static readonly componentRegistrationOrder = new Map<Constructor, number>();
  private static readonly tokenIdentityIds = new Map<TokenIdentifier<unknown>, string>();
  private static readonly tokenIdentityOwners = new Map<string, TokenIdentifier<unknown>>();
  private static lastResolutionTrace: DependencyResolutionTrace | undefined;
  private static nextComponentRegistrationOrder = 1;

  static get<T>(token: TokenIdentifier<T>): T {
    const trace = Container.buildResolutionTrace(token);

    try {
      const result = Container.resolveWithTrace(token, trace, []);
      Container.setLastResolutionTrace(Container.withTraceStatus(trace, "resolved"));
      return result;
    } catch (error) {
      const failureTrace = Container.normalizeFailureTrace(trace, error);
      Container.setLastResolutionTrace(failureTrace);

      if (error instanceof Problem) {
        throw error;
      }

      throw Container.toContainerResolutionProblem(token, error, failureTrace);
    }
  }

  static getMany<T>(tokens: Array<TokenIdentifier<T>>): T[] {
    return tokens.map((token) => Container.get(token));
  }

  static getOptional<T>(token: TokenIdentifier<T>): T | undefined {
    try {
      return Container.get(token);
    } catch (error) {
      if (Container.isOptionalResolutionError(error)) {
        return undefined;
      }

      throw error;
    }
  }

  static getResolutionTrace<T>(token: TokenIdentifier<T>): DependencyResolutionTrace {
    const trace = Container.buildResolutionTrace(token);
    Container.setLastResolutionTrace(trace);
    return trace;
  }

  static getLastResolutionTrace(): DependencyResolutionTrace | undefined {
    return Container.getScopeState()?.lastResolutionTrace ?? Container.lastResolutionTrace;
  }

  static set<T>(token: TokenIdentifier<T>, instance: T): T {
    const scope = Container.getScopeState();
    if (scope) {
      Container.setScopedValue(scope.instance, token, instance);
      scope.tokens.add(token);
    } else {
      TypeDIContainer.set({
        id: Container.toTypeDIServiceIdentifier(token),
        value: instance,
      });
    }
    Container.getLazyProviders().delete(token);
    Container.setValidated(false);
    return instance;
  }

  static has<T>(token: TokenIdentifier<T>): boolean {
    return Container.getLazyProviders().has(token) || Container.hasRegisteredValue(token);
  }

  static createScope(): ContainerScope {
    return new ContainerScope();
  }

  static getActiveScopeId(): string | undefined {
    return Container.getScopeState()?.id;
  }

  static remove<T>(token: TokenIdentifier<T>): void {
    Container.removeRegisteredValue(token);
    Container.getLazyProviders().delete(token);
    if (Container.isConstructorToken(token)) {
      const label = Container.getConstructorTokenLabel(token);
      const scope = Container.getScopeState();
      if (scope) {
        scope.components.delete(token);
        scope.componentSourceLocations.delete(token);
        scope.explicitComponentSourceLocations.delete(token);
        scope.componentRegistrationOrder.delete(token);
        Container.clearConstructorLabelTokenIdentities(label);
      } else {
        MetadataStorage.delete(COMPONENT_METADATA_KEY, token);
        Container.componentSourceLocations.delete(token);
        Container.explicitComponentSourceLocations.delete(token);
        Container.componentRegistrationOrder.delete(token);
        Container.clearConstructorLabelTokenIdentities(label);
      }
    }
    Container.clearTokenIdentity(token);
    Container.setValidated(false);
  }

  static reset(): void {
    const scope = Container.getScopeState();
    if (scope) {
      scope.instance.reset({ strategy: "resetServices" });
      scope.componentRegistrationOrder.clear();
      scope.componentSourceLocations.clear();
      scope.components.clear();
      scope.explicitComponentSourceLocations.clear();
      scope.lazyProviders.clear();
      scope.tokenIdentityIds.clear();
      scope.tokenIdentityOwners.clear();
      scope.tokens.clear();
      delete scope.lastResolutionTrace;
      scope.nextComponentRegistrationOrder = 1;
      scope.validated = false;
      return;
    }

    TypeDIContainer.of().reset({ strategy: "resetServices" });
    TypeDIContainer.reset();
    // reset은 요청 처리가 없는 idle 시점에만 호출한다.
    MetadataStorage.clear();
    Container.lazyProviders.clear();
    Container.symbolTokens.clear();
    Container.componentSourceLocations.clear();
    Container.explicitComponentSourceLocations.clear();
    Container.componentRegistrationOrder.clear();
    Container.tokenIdentityIds.clear();
    Container.tokenIdentityOwners.clear();
    Container.lastResolutionTrace = undefined;
    Container.nextComponentRegistrationOrder = 1;
    Container.validated = false;
  }

  static validate(options: ContainerValidationOptions = {}): void {
    if (Container.isValidated()) {
      return;
    }

    if (!options.force && !Container.isValidationEnabled()) {
      return;
    }

    const nodes = Container.getRegisteredComponents();
    if (nodes.length === 0) {
      Container.setValidated(true);
      return;
    }

    const graph = Container.buildDependencyGraph(nodes);
    Container.assertNoCircularDependency(nodes, graph);
    Container.assertNoDependencyGraphDiagnostics(nodes);

    Container.setValidated(true);
  }

  static createDependencyGraphManifest(
    options: {
      readonly roots?: readonly TokenIdentifier<unknown>[];
    } = {},
  ): DependencyGraphManifest {
    const roots = [...(options.roots ?? Container.getRegisteredComponents())].sort((left, right) =>
      Container.compareTokens(left, right),
    );
    const traces = roots.map((root) => Container.buildResolutionTrace(root));
    const diagnostics = Container.createGraphDiagnostics(traces);

    return {
      version: "croco.di-graph.manifest.v1",
      status: diagnostics.length === 0 ? "ready" : "failed",
      roots: roots.map((root) => Container.describeToken(root).label),
      rootIds: roots.map((root) => Container.describeToken(root).id),
      providers: Container.createGraphProviders(traces),
      diagnostics,
    };
  }

  static register<T>(token: Constructor<T>, scope: Scope): void {
    const label = Container.getConstructorTokenLabel(token);
    const registrationOrder = Container.getComponentRegistrationOrder();
    if (!registrationOrder.has(token)) {
      const activeScope = Container.getScopeState();
      const nextRegistrationOrder =
        activeScope?.nextComponentRegistrationOrder ?? Container.nextComponentRegistrationOrder;
      registrationOrder.set(token, nextRegistrationOrder);
      if (activeScope) {
        activeScope.nextComponentRegistrationOrder += 1;
      } else {
        Container.nextComponentRegistrationOrder += 1;
      }
    }
    Container.clearConstructorLabelTokenIdentities(label);

    const metadata = {
      scope,
      target: token,
    };
    const activeScope = Container.getScopeState();
    if (activeScope) {
      activeScope.components.set(token, metadata);
    } else {
      MetadataStorage.define(COMPONENT_METADATA_KEY, token, metadata);
    }
    const explicitSourceLocations = Container.getExplicitComponentSourceLocations();
    const sourceLocations = Container.getComponentSourceLocations();
    const sourceLocation = explicitSourceLocations.get(token) ?? Container.captureSourceLocation();
    if (sourceLocation) {
      sourceLocations.set(token, sourceLocation);
    } else {
      sourceLocations.delete(token);
    }
    Container.setValidated(false);
  }

  static setComponentSourceLocation<T>(
    token: Constructor<T>,
    sourceLocation?: DependencySourceLocation,
  ): void {
    const explicitSourceLocations = Container.getExplicitComponentSourceLocations();
    const sourceLocations = Container.getComponentSourceLocations();
    if (!sourceLocation) {
      explicitSourceLocations.delete(token);
      sourceLocations.delete(token);
      Container.setValidated(false);
      return;
    }

    const normalizedSourceLocation = Container.normalizeSourceLocation(sourceLocation);
    explicitSourceLocations.set(token, normalizedSourceLocation);
    sourceLocations.set(token, normalizedSourceLocation);
    Container.setValidated(false);
  }

  static async registerAsync<T>(token: TokenIdentifier<T>, factory: () => Promise<T>): Promise<T> {
    const instance = await factory();
    return Container.set(token, instance);
  }

  static registerLazy<T>(token: TokenIdentifier<T>, factory: () => T): void {
    Container.getLazyProviders().set(token, factory);
    Container.setValidated(false);
  }

  private static isValidationEnabled(): boolean {
    const configured = process.env.CROCO_DI_VALIDATE;
    if (configured !== undefined) {
      return configured !== "0" && configured.toLowerCase() !== "false";
    }

    return process.env.NODE_ENV !== "production";
  }

  private static getRegisteredComponents(): Constructor[] {
    const registered = MetadataStorage.getAll<{ scope: Scope; target: Constructor }>(
      COMPONENT_METADATA_KEY,
    ).map((entry) => entry.target as Constructor);
    const scoped = Container.getScopeState()?.components.keys() ?? [];
    return Array.from(new Set([...registered, ...scoped]));
  }

  private static buildDependencyGraph(nodes: Constructor[]): Map<Constructor, Constructor[]> {
    const nodeSet = new Set(nodes);
    const graph = new Map<Constructor, Constructor[]>();

    for (const node of nodes) {
      const paramTypes =
        (Reflect.getMetadata("design:paramtypes", node) as Constructor[] | undefined) ?? [];
      const dependencies: Constructor[] = [];

      Container.getConstructorParameterIndices(node, paramTypes).forEach((parameterIndex) => {
        const injectedToken = getParameterInjectionToken(node, parameterIndex);
        if (parameterIndex >= node.length && injectedToken === undefined) {
          return;
        }

        const dependency = injectedToken ?? paramTypes[parameterIndex];
        if (typeof dependency === "function" && nodeSet.has(dependency as Constructor)) {
          dependencies.push(dependency as Constructor);
        }
      });
      graph.set(node, dependencies);
    }

    return graph;
  }

  private static assertNoCircularDependency(
    nodes: Constructor[],
    graph: Map<Constructor, Constructor[]>,
  ): void {
    const visitState = new Map<Constructor, 0 | 1 | 2>();
    const stack: Constructor[] = [];
    const stackIndex = new Map<Constructor, number>();

    const visit = (node: Constructor): void => {
      visitState.set(node, 1);
      stackIndex.set(node, stack.length);
      stack.push(node);

      const deps = graph.get(node) ?? [];
      for (const dep of deps) {
        const state = visitState.get(dep) ?? 0;
        if (state === 0) {
          visit(dep);
          continue;
        }

        if (state === 1) {
          const cycleStartIndex = stackIndex.get(dep) ?? 0;
          const cycle = stack.slice(cycleStartIndex).concat(dep);
          throw new CircularDependencyProblem(cycle.map((t) => t.name));
        }
      }

      stack.pop();
      stackIndex.delete(node);
      visitState.set(node, 2);
    };

    for (const node of nodes) {
      if ((visitState.get(node) ?? 0) === 0) {
        visit(node);
      }
    }
  }

  private static assertNoDependencyGraphDiagnostics(nodes: Constructor[]): void {
    const traces = nodes.map((node) => Container.buildResolutionTrace(node));
    const diagnostics = Container.createGraphDiagnostics(traces);
    const errorDiagnostic = diagnostics.find((diagnostic) => diagnostic.severity === "error");

    if (!errorDiagnostic) {
      return;
    }

    throw ProblemFactory.internalServerError(errorDiagnostic.code, errorDiagnostic.message, {
      extensions: {
        resolution: errorDiagnostic.trace,
        legacyCode: errorDiagnostic.legacyCode,
        token: errorDiagnostic.token,
        tokenId: errorDiagnostic.tokenId,
        path: errorDiagnostic.path,
        pathIds: errorDiagnostic.pathIds,
      },
    });
  }

  private static createGraphProviders(
    traces: readonly DependencyResolutionTrace[],
  ): DependencyGraphProvider[] {
    const providers = new Map<
      string,
      Omit<DependencyGraphProvider, "dependencies" | "dependencyIds"> & {
        readonly dependencies: Map<string, string>;
      }
    >();

    for (const trace of traces) {
      for (const step of trace.steps) {
        const existing = providers.get(step.tokenId);
        const provider = existing ?? {
          token: step.token,
          tokenId: step.tokenId,
          tokenKind: step.tokenKind,
          provider: step.provider,
          status: step.status,
          dependencies: new Map<string, string>(),
          ...(step.scope ? { scope: step.scope } : {}),
          ...Container.getSourceLocationForTokenId(step.tokenId),
        };

        if (step.dependencyOf && step.dependencyOfId) {
          const dependencyOf = providers.get(step.dependencyOfId) ?? {
            token: step.dependencyOf,
            tokenId: step.dependencyOfId,
            tokenKind: "constructor" as DependencyTokenKind,
            provider: "missing" as DependencyProviderKind,
            status: "missing" as DependencyResolutionStepStatus,
            dependencies: new Map<string, string>(),
            ...Container.getSourceLocationForTokenId(step.dependencyOfId),
          };
          dependencyOf.dependencies.set(step.tokenId, step.token);
          providers.set(step.dependencyOfId, dependencyOf);
        }

        providers.set(step.tokenId, provider);
      }
    }

    return Array.from(providers.values())
      .map((provider) => ({
        ...provider,
        ...Container.sortProviderDependencies(provider.dependencies),
      }))
      .sort((left, right) =>
        Container.compareTokenDescriptions(
          { label: left.token, id: left.tokenId },
          { label: right.token, id: right.tokenId },
        ),
      );
  }

  private static createGraphDiagnostics(
    traces: readonly DependencyResolutionTrace[],
  ): DependencyGraphDiagnostic[] {
    const diagnostics: DependencyGraphDiagnostic[] = [];
    const seen = new Set<string>();

    const pushDiagnostic = (diagnostic: DependencyGraphDiagnostic): void => {
      const key = `${diagnostic.code}:${diagnostic.tokenId}:${diagnostic.pathIds.join("->")}`;
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      diagnostics.push(diagnostic);
    };

    for (const trace of traces) {
      for (const step of trace.steps) {
        if (step.status === "missing") {
          pushDiagnostic({
            code: "CROCO_DI_001",
            legacyCode: "framework-context/di-missing-provider",
            severity: "error",
            token: step.token,
            tokenId: step.tokenId,
            status: "missing",
            message: `Provider '${step.token}' is not registered. Resolution path: ${step.path.join(" -> ")}.`,
            path: step.path,
            pathIds: step.pathIds,
            trace,
            ...Container.getSourceLocationForTokenId(step.tokenId),
          });
          continue;
        }

        if (step.status === "circular") {
          pushDiagnostic({
            code: "CROCO_DI_002",
            legacyCode: "framework-context/di-circular-dependency",
            severity: "error",
            token: step.token,
            tokenId: step.tokenId,
            status: "circular",
            message: step.reason,
            path: step.path,
            pathIds: step.pathIds,
            trace,
            ...Container.getSourceLocationForTokenId(step.tokenId),
          });
          continue;
        }

        if (step.status === "scope-mismatch") {
          pushDiagnostic({
            code: "CROCO_DI_003",
            legacyCode: "framework-context/di-scope-mismatch",
            severity: "error",
            token: step.token,
            tokenId: step.tokenId,
            status: "scope-mismatch",
            message: step.reason,
            path: step.path,
            pathIds: step.pathIds,
            trace,
            ...Container.getSourceLocationForTokenId(step.tokenId),
          });
          continue;
        }

        if (step.provider === "typedi") {
          pushDiagnostic({
            code: "CROCO_DI_004",
            legacyCode: "framework-context/di-unknown-provider",
            severity: "error",
            token: step.token,
            tokenId: step.tokenId,
            status: "failed",
            message: `Provider '${step.token}' depends on TypeDI fallback metadata and cannot be statically verified.`,
            path: step.path,
            pathIds: step.pathIds,
            trace,
            ...Container.getSourceLocationForTokenId(step.tokenId),
          });
        }
      }
    }

    return diagnostics.sort((left, right) => {
      const codeOrder = left.code.localeCompare(right.code);
      if (codeOrder !== 0) {
        return codeOrder;
      }

      const tokenOrder = left.token.localeCompare(right.token);
      if (tokenOrder !== 0) {
        return tokenOrder;
      }

      const tokenIdOrder = left.tokenId.localeCompare(right.tokenId);
      if (tokenIdOrder !== 0) {
        return tokenIdOrder;
      }

      const pathOrder = left.pathIds.join(">").localeCompare(right.pathIds.join(">"));
      return pathOrder === 0 ? left.message.localeCompare(right.message) : pathOrder;
    });
  }

  private static sortProviderDependencies(dependenciesById: Map<string, string>): {
    readonly dependencies: readonly string[];
    readonly dependencyIds: readonly string[];
  } {
    const sortedDependencies = Array.from(dependenciesById.entries()).sort(
      ([leftId, leftToken], [rightId, rightToken]) =>
        Container.compareTokenDescriptions(
          { label: leftToken, id: leftId },
          { label: rightToken, id: rightId },
        ),
    );

    return {
      dependencies: sortedDependencies.map(([, token]) => token),
      dependencyIds: sortedDependencies.map(([id]) => id),
    };
  }

  private static compareTokens<T>(left: TokenIdentifier<T>, right: TokenIdentifier<T>): number {
    return Container.compareTokenDescriptions(
      Container.describeToken(left),
      Container.describeToken(right),
    );
  }

  private static compareTokenDescriptions(
    left: { readonly label: string; readonly id: string },
    right: { readonly label: string; readonly id: string },
  ): number {
    const labelOrder = left.label.localeCompare(right.label);
    return labelOrder === 0 ? left.id.localeCompare(right.id) : labelOrder;
  }

  private static getSourceLocationForTokenId(tokenId: string): {
    readonly sourceLocation?: DependencySourceLocation;
  } {
    const token = Container.getTokenIdentityOwners().get(tokenId);
    const sourceLocation =
      token && Container.isConstructorToken(token)
        ? Container.getComponentSourceLocations().get(token)
        : undefined;

    return sourceLocation ? { sourceLocation } : {};
  }

  private static captureSourceLocation(): DependencySourceLocation | undefined {
    const stack = new Error().stack?.split("\n").slice(2) ?? [];

    for (const line of stack) {
      const sourceLocation = Container.parseStackSourceLocation(line);
      if (!sourceLocation) {
        continue;
      }

      if (Container.isInternalSourceLocation(sourceLocation.file)) {
        continue;
      }

      return sourceLocation;
    }

    return undefined;
  }

  private static parseStackSourceLocation(line: string): DependencySourceLocation | undefined {
    const trimmed = line.trim();
    const match =
      trimmed.match(/\(([^()]+):(\d+):(\d+)\)$/) ??
      trimmed.match(/^at\s+(.+):(\d+):(\d+)$/) ??
      trimmed.match(/^(.+):(\d+):(\d+)$/);
    if (!match) {
      return undefined;
    }

    const rawFile = match[1]?.trim().replace(/^async\s+/, "");

    if (!rawFile || !Container.isStackSourceLocationCandidate(rawFile)) {
      return undefined;
    }

    return Container.normalizeSourceLocation({
      file: rawFile,
      line: Number(match[2]),
      column: Number(match[3]),
    });
  }

  private static isStackSourceLocationCandidate(file: string): boolean {
    const normalizedFile = file.replace(/\\/g, "/");
    return (
      normalizedFile.length > 0 &&
      normalizedFile !== "native" &&
      normalizedFile !== "<anonymous>" &&
      !normalizedFile.startsWith("node:") &&
      !normalizedFile.startsWith("internal/")
    );
  }

  private static isInternalSourceLocation(file: string): boolean {
    const internalMatchFile = file.replace(/\\/g, "/").replace(/\/\.\//g, "/");

    return (
      (internalMatchFile.startsWith("src/libs/") && Container.isFrameworkContextPackageCwd()) ||
      internalMatchFile.startsWith("packages/framework-context/src/libs/") ||
      internalMatchFile.startsWith("packages/framework-context/dist/") ||
      internalMatchFile.includes("/packages/framework-context/src/libs/") ||
      internalMatchFile.includes("/packages/framework-context/dist/") ||
      internalMatchFile.startsWith("node_modules/@croco/framework-context/") ||
      internalMatchFile.includes("/node_modules/@croco/framework-context/") ||
      internalMatchFile.includes("://@croco/framework-context/")
    );
  }

  private static isFrameworkContextPackageCwd(): boolean {
    return process.cwd().replace(/\\/g, "/").endsWith("/packages/framework-context");
  }

  private static normalizeSourceLocation(
    sourceLocation: DependencySourceLocation,
  ): DependencySourceLocation {
    return {
      file: Container.normalizeSourceFile(sourceLocation.file.replace(/^file:\/\//, "")),
      ...(sourceLocation.line === undefined ? {} : { line: sourceLocation.line }),
      ...(sourceLocation.column === undefined ? {} : { column: sourceLocation.column }),
    };
  }

  private static normalizeSourceFile(file: string): string {
    const normalizedFile = file.replace(/\\/g, "/");
    const cwd = process.cwd().replace(/\\/g, "/");
    const prefix = `${cwd}/`;

    return normalizedFile.startsWith(prefix) ? normalizedFile.slice(prefix.length) : normalizedFile;
  }

  static getComponentMetadata(target: Constructor): ComponentMetadata | undefined {
    return (
      Container.getScopeState()?.components.get(target) ??
      MetadataStorage.get(COMPONENT_METADATA_KEY, target)
    );
  }

  static getDiagnosticsSnapshot(): {
    isInitialized: boolean;
    registeredServiceCount: number;
    scopes: string[];
    lastResolutionTrace?: DependencyResolutionTrace;
  } {
    const components = Container.getRegisteredComponents();
    const scopes = new Set<string>();
    for (const comp of components) {
      const meta = Container.getComponentMetadata(comp);
      if (meta?.scope) {
        scopes.add(meta.scope);
      }
    }
    const lastResolutionTrace = Container.getLastResolutionTrace();
    return {
      isInitialized: Container.isValidated(),
      registeredServiceCount: components.length,
      scopes: Array.from(scopes),
      ...(lastResolutionTrace ? { lastResolutionTrace } : {}),
    };
  }

  private static getScopeState(): ContainerScopeState | undefined {
    const scope = containerScopeStorage.getStore();
    if (scope?.disposed) {
      throw createContainerScopeDisposedProblem(scope.id);
    }
    return scope;
  }

  private static getComponentRegistrationOrder(): Map<Constructor, number> {
    return (
      Container.getScopeState()?.componentRegistrationOrder ?? Container.componentRegistrationOrder
    );
  }

  private static getComponentSourceLocations(): Map<Constructor, DependencySourceLocation> {
    return (
      Container.getScopeState()?.componentSourceLocations ?? Container.componentSourceLocations
    );
  }

  private static getExplicitComponentSourceLocations(): Map<Constructor, DependencySourceLocation> {
    return (
      Container.getScopeState()?.explicitComponentSourceLocations ??
      Container.explicitComponentSourceLocations
    );
  }

  private static getTokenIdentityIds(): Map<TokenIdentifier<unknown>, string> {
    return Container.getScopeState()?.tokenIdentityIds ?? Container.tokenIdentityIds;
  }

  private static getTokenIdentityOwners(): Map<string, TokenIdentifier<unknown>> {
    return Container.getScopeState()?.tokenIdentityOwners ?? Container.tokenIdentityOwners;
  }

  private static getLazyProviders(): Map<TokenIdentifier<unknown>, () => unknown> {
    return Container.getScopeState()?.lazyProviders ?? Container.lazyProviders;
  }

  private static isValidated(): boolean {
    return Container.getScopeState()?.validated ?? Container.validated;
  }

  private static setValidated(validated: boolean): void {
    const scope = Container.getScopeState();
    if (scope) {
      scope.validated = validated;
      return;
    }

    Container.validated = validated;
  }

  private static setLastResolutionTrace(trace: DependencyResolutionTrace | undefined): void {
    const scope = Container.getScopeState();
    if (scope) {
      if (trace === undefined) {
        delete scope.lastResolutionTrace;
      } else {
        scope.lastResolutionTrace = trace;
      }
      return;
    }

    Container.lastResolutionTrace = trace;
  }

  private static shouldResolveLazy<T>(token: TokenIdentifier<T>): boolean {
    return Container.getLazyProviders().has(token) && !Container.hasRegisteredValue(token);
  }

  private static resolveLazy<T>(token: TokenIdentifier<T>): T {
    const factory = Container.getLazyProviders().get(token);
    if (!factory) {
      return Container.getRegisteredValue(token);
    }

    const instance = factory() as T;
    Container.set(token, instance);
    return instance;
  }

  /**
   * Returns the TypeDI identifier used internally for a Croco token.
   * Symbol mappings remain stable until {@link Container.reset}.
   */
  static toTypeDIServiceIdentifier<T>(token: TokenIdentifier<T>): ServiceIdentifier<T> {
    if (typeof token === "symbol") {
      return Container.getOrCreateSymbolToken(token) as TypeDIToken<T>;
    }

    return token as ServiceIdentifier<T>;
  }

  private static getOrCreateSymbolToken(symbol: symbol): TypeDIToken<unknown> {
    const existing = Container.symbolTokens.get(symbol);
    if (existing) {
      return existing;
    }

    const token = new TypeDIToken(Symbol.keyFor(symbol) ?? symbol.description ?? symbol.toString());
    Container.symbolTokens.set(symbol, token);
    return token;
  }

  private static isConstructorToken<T>(token: TokenIdentifier<T>): token is Constructor<T> {
    return typeof token === "function";
  }

  private static getRegisteredValue<T>(token: TokenIdentifier<T>): T {
    const scope = Container.getScopeState();
    if (scope && !scope.tokens.has(token)) {
      throw new ServiceNotFoundError(Container.toTypeDIServiceIdentifier(token));
    }

    const target = scope?.instance ?? TypeDIContainer;
    if (typeof token === "symbol") {
      return target.get(Container.getOrCreateSymbolToken(token) as TypeDIToken<T>);
    }

    if (typeof token === "string") {
      return target.get(token);
    }

    if (token instanceof TypeDIToken) {
      return target.get(token);
    }

    return target.get(Container.toTypeDIConstructable(token));
  }

  private static setScopedValue<T>(
    container: TypeDIContainerInstance,
    token: TokenIdentifier<T>,
    instance: T,
  ): void {
    if (typeof token === "symbol") {
      container.set(Container.getOrCreateSymbolToken(token) as TypeDIToken<T>, instance);
      return;
    }

    if (typeof token === "string") {
      container.set(token, instance);
      return;
    }

    if (token instanceof TypeDIToken) {
      container.set(token, instance);
      return;
    }

    container.set(Container.toTypeDIConstructable(token), instance);
  }

  private static hasRegisteredValue<T>(token: TokenIdentifier<T>): boolean {
    const scope = Container.getScopeState();
    if (scope) {
      return scope.tokens.has(token);
    }

    const target = TypeDIContainer;
    if (typeof token === "symbol") {
      return target.has(Container.getOrCreateSymbolToken(token));
    }

    if (typeof token === "string") {
      return target.has(token);
    }

    if (token instanceof TypeDIToken) {
      return target.has(token);
    }

    return target.has(Container.toTypeDIConstructable(token));
  }

  private static removeRegisteredValue<T>(token: TokenIdentifier<T>): void {
    const scope = Container.getScopeState();
    if (scope) {
      Container.removeScopedValue(scope.instance, token);
      scope.tokens.delete(token);
      return;
    }

    const target = TypeDIContainer;
    if (typeof token === "symbol") {
      target.remove(Container.getOrCreateSymbolToken(token));
      return;
    }

    if (typeof token === "string") {
      target.remove(token);
      return;
    }

    if (token instanceof TypeDIToken) {
      target.remove(token);
      return;
    }

    target.remove(Container.toTypeDIConstructable(token));
  }

  private static removeScopedValue<T>(
    container: TypeDIContainerInstance,
    token: TokenIdentifier<T>,
  ): void {
    if (typeof token === "symbol") {
      container.remove(Container.getOrCreateSymbolToken(token));
      return;
    }

    if (typeof token === "string") {
      container.remove(token);
      return;
    }

    if (token instanceof TypeDIToken) {
      container.remove(token);
      return;
    }

    container.remove(Container.toTypeDIConstructable(token));
  }

  private static toTypeDIConstructable<T>(token: Constructor<T>): TypeDIConstructable<T> {
    return token as unknown as TypeDIConstructable<T>;
  }

  private static isOptionalResolutionError(error: unknown): error is Error {
    return (
      (error instanceof ContainerResolutionProblem && error.reason === "missing-provider") ||
      (error instanceof Error &&
        (error.name === "ServiceNotFoundError" || error.name === "CannotInstantiateValueError"))
    );
  }

  private static resolveWithTrace<T>(
    token: TokenIdentifier<T>,
    trace: DependencyResolutionTrace,
    stack: TokenIdentifier<unknown>[],
  ): T {
    Container.assertNoRuntimeCircularDependency(token, stack);

    if (Container.shouldResolveLazy(token)) {
      return Container.resolveLazy(token);
    }

    if (!Container.isConstructorToken(token)) {
      return Container.getRegisteredValue(token);
    }

    const constructorToken = token as Constructor<T>;
    const metadata = Container.getComponentMetadata(constructorToken);

    if (!metadata) {
      return Container.getRegisteredValue(constructorToken);
    }

    Container.assertScopeCompatibility(constructorToken, stack, trace);

    const nextStack = [...stack, token as TokenIdentifier<unknown>];

    switch (metadata.scope) {
      case "singleton":
        return Container.getSingletonInstance(constructorToken, trace, nextStack);

      case "transient":
        return Container.createTransientInstance(constructorToken, trace, nextStack);

      case "request":
        return Container.getRequestScoped(constructorToken, trace, nextStack);

      default:
        return Container.getRegisteredValue(constructorToken);
    }
  }

  private static createTransientInstance<T>(
    token: Constructor<T>,
    trace: DependencyResolutionTrace,
    stack: TokenIdentifier<unknown>[],
  ): T {
    const dependencies = Container.resolveDependencies(token, trace, stack);
    return Reflect.construct(token, dependencies) as T;
  }

  private static getSingletonInstance<T>(
    token: Constructor<T>,
    trace: DependencyResolutionTrace,
    stack: TokenIdentifier<unknown>[],
  ): T {
    if (Container.hasRegisteredValue(token)) {
      return Container.getRegisteredValue(token);
    }

    const instance = Container.createTransientInstance(token, trace, stack);
    Container.set(token, instance);
    return instance;
  }

  private static resolveDependencies<T>(
    token: Constructor<T>,
    trace: DependencyResolutionTrace,
    stack: TokenIdentifier<unknown>[],
  ): unknown[] {
    const paramTypes =
      (Reflect.getMetadata("design:paramtypes", token) as Constructor[] | undefined) ?? [];
    const handlerContainer = Container.createHandlerContainer(trace, stack);
    const handlers = TypeDIContainer.handlers.filter(
      (candidate) =>
        (candidate.object === token || candidate.object === Object.getPrototypeOf(token)) &&
        typeof candidate.index === "number",
    );

    return Container.getConstructorParameterIndices(token, paramTypes).map((index) => {
      const handler = handlers.find((candidate) => candidate.index === index);

      if (handler) {
        return handler.value(handlerContainer);
      }

      if (index >= token.length) {
        return undefined;
      }

      const paramType = paramTypes[index];
      if (paramType === undefined) {
        const failureTrace = Container.withTraceStatus(trace, "missing");
        throw new ContainerResolutionProblem(
          `DI resolution failed for ${token.name}: constructor parameter ${index} has no runtime token. Add an explicit @Inject(...) token or emit design:paramtypes metadata.`,
          failureTrace,
          "missing-provider",
        );
      }

      Container.assertScopeCompatibility(paramType, stack, trace);
      return Container.resolveWithTrace(paramType, trace, stack);
    });
  }

  private static createHandlerContainer(
    trace: DependencyResolutionTrace,
    stack: TokenIdentifier<unknown>[],
  ): TypeDIContainerInstance {
    return new HandlerContainerInstance("__croco_handler__", (id) =>
      Container.resolveHandlerDependency(id, trace, stack),
    );
  }

  private static resolveHandlerDependency<T>(
    token: TokenIdentifier<T>,
    trace: DependencyResolutionTrace,
    stack: TokenIdentifier<unknown>[],
  ): T {
    Container.assertScopeCompatibility(token, stack, trace);
    return Container.resolveWithTrace(token, trace, stack);
  }

  private static buildResolutionTrace<T>(
    token: TokenIdentifier<T>,
    status?: DependencyResolutionTraceStatus,
  ): DependencyResolutionTrace {
    const steps: DependencyResolutionStep[] = [];
    Container.collectResolutionSteps(token, [], steps);
    return {
      root: Container.describeToken(token).label,
      status: status ?? Container.computeTraceStatus(steps),
      steps,
    };
  }

  private static collectResolutionSteps<T>(
    token: TokenIdentifier<T>,
    path: TokenIdentifier<unknown>[],
    steps: DependencyResolutionStep[],
    edge?: Pick<DependencyResolutionStep, "dependencyOf" | "dependencyOfId" | "parameterIndex">,
  ): void {
    const nextPath = [...path, token as TokenIdentifier<unknown>];
    const cycleStartIndex = path.findIndex((entry) => Container.isSameToken(entry, token));

    if (cycleStartIndex >= 0) {
      steps.push(
        Container.createResolutionStep(token, path, {
          ...edge,
          status: "circular",
          reason: `Circular dependency detected through ${nextPath
            .slice(cycleStartIndex)
            .map((entry) => Container.describeToken(entry).label)
            .join(" -> ")}.`,
        }),
      );
      return;
    }

    const scopeMismatch = Container.getScopeMismatch(token, path);
    if (scopeMismatch) {
      steps.push(
        Container.createResolutionStep(token, path, {
          ...edge,
          status: "scope-mismatch",
          reason: `Singleton-scoped component ${scopeMismatch.singleton} cannot depend on request-scoped component ${scopeMismatch.requestScoped}.`,
        }),
      );
      return;
    }

    const step = Container.createResolutionStep(token, path, edge);
    steps.push(step);

    if (
      step.status !== "selected" ||
      !Container.isConstructorToken(token) ||
      step.provider !== "component"
    ) {
      return;
    }

    const paramTypes =
      (Reflect.getMetadata("design:paramtypes", token) as Constructor[] | undefined) ?? [];
    Container.getConstructorParameterIndices(token, paramTypes).forEach((parameterIndex) => {
      const injectedToken = getParameterInjectionToken(token, parameterIndex);
      if (!injectedToken && parameterIndex >= token.length) {
        return;
      }

      const dependency = injectedToken ?? paramTypes[parameterIndex];
      if (dependency === undefined) {
        return;
      }

      Container.collectResolutionSteps(dependency, nextPath, steps, {
        dependencyOf: step.token,
        dependencyOfId: step.tokenId,
        parameterIndex,
      });
    });
  }

  private static getConstructorParameterIndices(
    token: Constructor,
    paramTypes: readonly Constructor[],
  ): number[] {
    const parameterCount = TypeDIContainer.handlers.reduce(
      (count, handler) => {
        const belongsToToken =
          handler.object === token || handler.object === Object.getPrototypeOf(token);
        if (!belongsToToken || typeof handler.index !== "number") {
          return count;
        }

        return Math.max(count, handler.index + 1);
      },
      Math.max(paramTypes.length, token.length),
    );

    return Array.from({ length: parameterCount }, (_, index) => index);
  }

  private static createResolutionStep<T>(
    token: TokenIdentifier<T>,
    path: TokenIdentifier<unknown>[],
    overrides: Partial<DependencyResolutionStep> = {},
  ): DependencyResolutionStep {
    const described = Container.describeToken(token);
    const selection = Container.describeProviderSelection(token);
    const pathTokens = [...path, token as TokenIdentifier<unknown>];
    return {
      token: described.label,
      tokenId: described.id,
      tokenKind: described.kind,
      provider: overrides.provider ?? selection.provider,
      status: overrides.status ?? selection.status,
      reason: overrides.reason ?? selection.reason,
      path: pathTokens.map((entry) => Container.describeToken(entry).label),
      pathIds: pathTokens.map((entry) => Container.describeToken(entry).id),
      ...(selection.scope ? { scope: selection.scope } : {}),
      ...(overrides.dependencyOf ? { dependencyOf: overrides.dependencyOf } : {}),
      ...(overrides.dependencyOfId ? { dependencyOfId: overrides.dependencyOfId } : {}),
      ...(overrides.parameterIndex !== undefined
        ? { parameterIndex: overrides.parameterIndex }
        : {}),
    };
  }

  private static describeProviderSelection<T>(token: TokenIdentifier<T>): {
    provider: DependencyProviderKind;
    status: DependencyResolutionStepStatus;
    reason: string;
    scope?: Scope;
  } {
    const metadata = Container.isConstructorToken(token)
      ? Container.getComponentMetadata(token)
      : undefined;

    if (Container.shouldResolveLazy(token)) {
      return {
        provider: "lazy",
        status: "selected",
        reason: "Lazy provider registered with Container.registerLazy().",
        ...(metadata?.scope ? { scope: metadata.scope } : {}),
      };
    }

    if (metadata) {
      if (metadata.scope === "singleton" && Container.hasRegisteredValue(token)) {
        return {
          provider: "registered-value",
          status: "selected",
          reason: "Singleton component instance is already registered.",
          scope: metadata.scope,
        };
      }

      return {
        provider: "component",
        status: "selected",
        reason: `Component metadata selected ${metadata.scope} scope.`,
        scope: metadata.scope,
      };
    }

    if (Container.hasRegisteredValue(token)) {
      return {
        provider: "registered-value",
        status: "selected",
        reason: "Explicit provider value registered with Container.set().",
      };
    }

    if (!Container.isConstructorToken(token)) {
      return {
        provider: "missing",
        status: "missing",
        reason: "No provider is registered for this token.",
      };
    }

    return {
      provider: "typedi",
      status: "selected",
      reason: "No Croco component metadata found; TypeDI fallback will be attempted.",
    };
  }

  private static computeTraceStatus(
    steps: readonly DependencyResolutionStep[],
  ): DependencyResolutionTraceStatus {
    if (steps.some((step) => step.status === "circular")) {
      return "circular";
    }
    if (steps.some((step) => step.status === "scope-mismatch")) {
      return "scope-mismatch";
    }
    if (steps.some((step) => step.status === "missing")) {
      return "missing";
    }
    return "ready";
  }

  private static withTraceStatus(
    trace: DependencyResolutionTrace,
    status: DependencyResolutionTraceStatus,
  ): DependencyResolutionTrace {
    return { ...trace, status };
  }

  private static normalizeFailureTrace(
    trace: DependencyResolutionTrace,
    error: unknown,
  ): DependencyResolutionTrace {
    if (
      error instanceof ContainerResolutionProblem ||
      error instanceof ContainerScopeMismatchProblem
    ) {
      return error.trace;
    }

    if (error instanceof CircularDependencyProblem) {
      return Container.withTraceStatus(trace, "circular");
    }

    if (Container.isTypeDIResolutionError(error)) {
      return Container.withTraceStatus(trace, "missing");
    }

    if (trace.status !== "ready") {
      return trace;
    }

    return Container.withTraceStatus(trace, "failed");
  }

  private static toContainerResolutionProblem<T>(
    token: TokenIdentifier<T>,
    error: unknown,
    trace: DependencyResolutionTrace,
  ): ContainerResolutionProblem {
    const cause = error instanceof Error ? error : undefined;
    const reason = Container.isTypeDIResolutionError(error)
      ? "missing-provider"
      : "construction-failed";
    const label = Container.describeToken(token).label;
    const causeDetail = cause?.message ? ` Cause: ${cause.message}` : "";
    const path = Container.getTracePath(trace);
    const detail =
      reason === "missing-provider"
        ? `DI resolution failed for ${label}: provider is not registered or cannot be constructed. Resolution path: ${path}.${causeDetail}`
        : `DI resolution failed for ${label}: construction failed. Resolution path: ${path}.${causeDetail}`;

    return new ContainerResolutionProblem(detail, trace, reason, cause);
  }

  private static assertNoRuntimeCircularDependency<T>(
    token: TokenIdentifier<T>,
    stack: TokenIdentifier<unknown>[],
  ): void {
    const cycleStartIndex = stack.findIndex((entry) => Container.isSameToken(entry, token));
    if (cycleStartIndex < 0) {
      return;
    }

    const cycle = stack
      .slice(cycleStartIndex)
      .concat(token as TokenIdentifier<unknown>)
      .map((entry) => Container.describeToken(entry).label);
    throw new CircularDependencyProblem(cycle);
  }

  private static assertScopeCompatibility<T>(
    token: TokenIdentifier<T>,
    stack: TokenIdentifier<unknown>[],
    trace: DependencyResolutionTrace,
  ): void {
    const scopeMismatch = Container.getScopeMismatch(token, stack);
    if (!scopeMismatch) {
      return;
    }

    throw new ContainerScopeMismatchProblem(
      scopeMismatch.singleton,
      scopeMismatch.requestScoped,
      scopeMismatch.path,
      Container.withTraceStatus(trace, "scope-mismatch"),
    );
  }

  private static getScopeMismatch<T>(
    token: TokenIdentifier<T>,
    path: TokenIdentifier<unknown>[],
  ):
    | {
        singleton: string;
        requestScoped: string;
        path: string[];
      }
    | undefined {
    if (!Container.isConstructorToken(token)) {
      return undefined;
    }

    const metadata = Container.getComponentMetadata(token);
    if (metadata?.scope !== "request") {
      return undefined;
    }

    const singletonAncestor = path.find(
      (entry): entry is Constructor =>
        Container.isConstructorToken(entry) &&
        Container.getComponentMetadata(entry)?.scope === "singleton",
    );

    if (!singletonAncestor) {
      return undefined;
    }

    return {
      singleton: Container.describeToken(singletonAncestor).label,
      requestScoped: Container.describeToken(token).label,
      path: [...path, token as TokenIdentifier<unknown>].map(
        (entry) => Container.describeToken(entry).label,
      ),
    };
  }

  private static describeToken<T>(token: TokenIdentifier<T>): {
    label: string;
    id: string;
    kind: DependencyTokenKind;
  } {
    if (typeof token === "string") {
      return { label: token, id: Container.getTokenId(token, "string", token), kind: "string" };
    }

    if (typeof token === "symbol") {
      const label = Symbol.keyFor(token) ?? token.description ?? token.toString();
      return {
        label,
        id: Container.getTokenId(token, "symbol", label),
        kind: "symbol",
      };
    }

    if (token instanceof TypeDIToken) {
      const label = `Token<${token.name ?? "UNSET_NAME"}>`;
      return {
        label,
        id: Container.getTokenId(token, "typedi-token", label),
        kind: "typedi-token",
      };
    }

    const label = token.name || "<anonymous>";
    return { label, id: Container.getTokenId(token, "constructor", label), kind: "constructor" };
  }

  private static getTokenId<T>(
    token: TokenIdentifier<T>,
    kind: DependencyTokenKind,
    label: string,
  ): string {
    const tokenIdentityIds = Container.getTokenIdentityIds();
    const tokenIdentityOwners = Container.getTokenIdentityOwners();
    const existing = tokenIdentityIds.get(token);
    if (existing) {
      return existing;
    }

    const baseId = Container.createTokenIdBase(token, kind, label);
    let id = baseId;
    let suffix = 2;
    while (true) {
      const owner = tokenIdentityOwners.get(id);
      if (!owner || Container.isSameToken(owner, token)) {
        tokenIdentityIds.set(token, id);
        tokenIdentityOwners.set(id, token);
        return id;
      }

      id = `${baseId}#${suffix}`;
      suffix += 1;
    }
  }

  private static createTokenIdBase<T>(
    token: TokenIdentifier<T>,
    kind: DependencyTokenKind,
    label: string,
  ): string {
    if (Container.isConstructorToken(token)) {
      return Container.createConstructorTokenIdBase(token, kind, label);
    }

    if (typeof token === "symbol") {
      const globalKey = Symbol.keyFor(token);
      if (globalKey) {
        return `${kind}:global:${Container.formatTokenIdPart(globalKey)}`;
      }
    }

    return `${kind}:${Container.formatTokenIdPart(label)}`;
  }

  private static createConstructorTokenIdBase<T>(
    token: Constructor<T>,
    kind: DependencyTokenKind,
    label: string,
  ): string {
    const labelPart = Container.formatTokenIdPart(label);
    const componentRegistrationOrder = Container.getComponentRegistrationOrder();
    const registrationOrder = componentRegistrationOrder.get(token);
    if (!registrationOrder) {
      return `${kind}:${labelPart}`;
    }

    const sameLabelComponents = [...componentRegistrationOrder.entries()]
      .filter(([candidate]) => Container.getConstructorTokenLabel(candidate) === label)
      .sort(([, leftOrder], [, rightOrder]) => leftOrder - rightOrder);
    const rank =
      sameLabelComponents.findIndex(([candidate]) => Container.isSameToken(candidate, token)) + 1;

    return rank > 1 ? `${kind}:${labelPart}#${rank}` : `${kind}:${labelPart}`;
  }

  private static formatTokenIdPart(value: string): string {
    return value.replace(/\\/g, "/");
  }

  private static getConstructorTokenLabel(token: Constructor): string {
    return token.name || "<anonymous>";
  }

  private static clearTokenIdentity<T>(token: TokenIdentifier<T>): void {
    const tokenIdentityIds = Container.getTokenIdentityIds();
    const tokenIdentityOwners = Container.getTokenIdentityOwners();
    const tokenId = tokenIdentityIds.get(token);
    if (tokenId) {
      tokenIdentityOwners.delete(tokenId);
    }
    tokenIdentityIds.delete(token);
  }

  private static clearConstructorLabelTokenIdentities(label: string): void {
    const tokenIdentityIds = Container.getTokenIdentityIds();
    const tokensToClear: TokenIdentifier<unknown>[] = [];

    for (const token of tokenIdentityIds.keys()) {
      if (
        Container.isConstructorToken(token) &&
        Container.getConstructorTokenLabel(token) === label
      ) {
        tokensToClear.push(token);
      }
    }

    for (const token of tokensToClear) {
      Container.clearTokenIdentity(token);
    }
  }

  private static isSameToken<T>(
    first: TokenIdentifier<unknown>,
    second: TokenIdentifier<T>,
  ): boolean {
    return first === second;
  }

  private static isTypeDIResolutionError(error: unknown): error is Error {
    return (
      error instanceof Error &&
      (error.name === "ServiceNotFoundError" || error.name === "CannotInstantiateValueError")
    );
  }

  private static getTracePath(trace: DependencyResolutionTrace): string {
    const lastStep = trace.steps[trace.steps.length - 1];
    return lastStep ? lastStep.path.join(" -> ") : trace.root;
  }

  private static getRequestScoped<T>(
    token: Constructor<T>,
    trace: DependencyResolutionTrace,
    stack: TokenIdentifier<unknown>[],
  ): T {
    const cache = Context.getCache();

    if (!cache) {
      throw ProblemFactory.internalServerError(
        "framework-context/request-scope-outside-context",
        "Request-scoped dependencies must be resolved inside Context.run().",
      );
    }

    const cached = cache.get(token);
    if (cached !== undefined) {
      return cached as T;
    }

    const instance = Container.createTransientInstance(token, trace, stack);
    cache.set(token, instance);
    return instance;
  }
}

export type { Service };
