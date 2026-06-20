import {
  type Service,
  Container as TypeDIContainer,
  ContainerInstance as TypeDIContainerInstance,
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

const COMPONENT_METADATA_KEY = Symbol("component:metadata");

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
  private static lastResolutionTrace: DependencyResolutionTrace | undefined;

  static get<T>(token: TokenIdentifier<T>): T {
    const trace = Container.buildResolutionTrace(token);

    try {
      const result = Container.resolveWithTrace(token, trace, []);
      Container.lastResolutionTrace = Container.withTraceStatus(trace, "resolved");
      return result;
    } catch (error) {
      Container.lastResolutionTrace = Container.normalizeFailureTrace(trace, error);

      if (error instanceof Problem) {
        throw error;
      }

      throw Container.toContainerResolutionProblem(token, error, Container.lastResolutionTrace);
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
    Container.lastResolutionTrace = trace;
    return trace;
  }

  static getLastResolutionTrace(): DependencyResolutionTrace | undefined {
    return Container.lastResolutionTrace;
  }

  static set<T>(token: TokenIdentifier<T>, instance: T): T {
    TypeDIContainer.set({ id: Container.resolveIdentifier(token), value: instance });
    Container.lazyProviders.delete(token);
    Container.validated = false;
    return instance;
  }

  static has<T>(token: TokenIdentifier<T>): boolean {
    return Container.lazyProviders.has(token) || Container.hasRegisteredValue(token);
  }

  static remove<T>(token: TokenIdentifier<T>): void {
    Container.removeRegisteredValue(token);
    Container.lazyProviders.delete(token);
    if (Container.isConstructorToken(token)) {
      MetadataStorage.delete(COMPONENT_METADATA_KEY, token);
      Container.componentSourceLocations.delete(token);
    }
    Container.validated = false;
  }

  static reset(): void {
    TypeDIContainer.reset();
    // reset은 요청 처리가 없는 idle 시점에만 호출한다.
    MetadataStorage.clear();
    Container.lazyProviders.clear();
    Container.symbolTokens.clear();
    Container.componentSourceLocations.clear();
    Container.lastResolutionTrace = undefined;
    Container.validated = false;
  }

  static validate(): void {
    if (Container.validated) {
      return;
    }

    if (!Container.isValidationEnabled()) {
      return;
    }

    const nodes = Container.getRegisteredComponents();
    if (nodes.length === 0) {
      Container.validated = true;
      return;
    }

    const graph = Container.buildDependencyGraph(nodes);
    Container.assertNoCircularDependency(nodes, graph);

    Container.validated = true;
  }

  static createDependencyGraphManifest(
    options: {
      readonly roots?: readonly TokenIdentifier<unknown>[];
    } = {},
  ): DependencyGraphManifest {
    const roots = [...(options.roots ?? Container.getRegisteredComponents())].sort((left, right) =>
      Container.describeToken(left).label.localeCompare(Container.describeToken(right).label),
    );
    const traces = roots.map((root) => Container.buildResolutionTrace(root));
    const diagnostics = Container.createGraphDiagnostics(traces);

    return {
      version: "croco.di-graph.manifest.v1",
      status: diagnostics.length === 0 ? "ready" : "failed",
      roots: roots.map((root) => Container.describeToken(root).label),
      providers: Container.createGraphProviders(traces),
      diagnostics,
    };
  }

  static register<T>(token: Constructor<T>, scope: Scope): void {
    MetadataStorage.define(COMPONENT_METADATA_KEY, token, {
      scope,
      target: token,
    });
    const sourceLocation = Container.captureSourceLocation();
    if (sourceLocation) {
      Container.componentSourceLocations.set(token, sourceLocation);
    } else {
      Container.componentSourceLocations.delete(token);
    }
    Container.validated = false;
  }

  static async registerAsync<T>(token: TokenIdentifier<T>, factory: () => Promise<T>): Promise<T> {
    const instance = await factory();
    return Container.set(token, instance);
  }

  static registerLazy<T>(token: TokenIdentifier<T>, factory: () => T): void {
    Container.lazyProviders.set(token, factory);
    Container.validated = false;
  }

  private static isValidationEnabled(): boolean {
    const configured = process.env.CROCO_DI_VALIDATE;
    if (configured !== undefined) {
      return configured !== "0" && configured.toLowerCase() !== "false";
    }

    return process.env.NODE_ENV !== "production";
  }

  private static getRegisteredComponents(): Constructor[] {
    return MetadataStorage.getAll<{ scope: Scope; target: Constructor }>(
      COMPONENT_METADATA_KEY,
    ).map((entry) => entry.target as Constructor);
  }

  private static buildDependencyGraph(nodes: Constructor[]): Map<Constructor, Constructor[]> {
    const nodeSet = new Set(nodes);
    const graph = new Map<Constructor, Constructor[]>();

    for (const node of nodes) {
      const paramTypes =
        (Reflect.getMetadata("design:paramtypes", node) as Constructor[] | undefined) ?? [];
      const dependencies = paramTypes.filter(
        (dep): dep is Constructor => typeof dep === "function" && nodeSet.has(dep),
      );
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

  private static createGraphProviders(
    traces: readonly DependencyResolutionTrace[],
  ): DependencyGraphProvider[] {
    const providers = new Map<
      string,
      Omit<DependencyGraphProvider, "dependencies"> & { readonly dependencies: Set<string> }
    >();

    for (const trace of traces) {
      for (const step of trace.steps) {
        const existing = providers.get(step.token);
        const provider = existing ?? {
          token: step.token,
          tokenKind: step.tokenKind,
          provider: step.provider,
          status: step.status,
          dependencies: new Set<string>(),
          ...(step.scope ? { scope: step.scope } : {}),
          ...Container.getSourceLocationForTokenLabel(step.token),
        };

        if (step.dependencyOf) {
          const dependencyOf = providers.get(step.dependencyOf) ?? {
            token: step.dependencyOf,
            tokenKind: "constructor" as DependencyTokenKind,
            provider: "missing" as DependencyProviderKind,
            status: "missing" as DependencyResolutionStepStatus,
            dependencies: new Set<string>(),
            ...Container.getSourceLocationForTokenLabel(step.dependencyOf),
          };
          dependencyOf.dependencies.add(step.token);
          providers.set(step.dependencyOf, dependencyOf);
        }

        providers.set(step.token, provider);
      }
    }

    return Array.from(providers.values())
      .map((provider) => ({
        ...provider,
        dependencies: Array.from(provider.dependencies).sort(),
      }))
      .sort((left, right) => left.token.localeCompare(right.token));
  }

  private static createGraphDiagnostics(
    traces: readonly DependencyResolutionTrace[],
  ): DependencyGraphDiagnostic[] {
    const diagnostics: DependencyGraphDiagnostic[] = [];
    const seen = new Set<string>();

    const pushDiagnostic = (diagnostic: DependencyGraphDiagnostic): void => {
      const key = `${diagnostic.code}:${diagnostic.token}:${diagnostic.path.join("->")}`;
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
            code: "framework-context/di-missing-provider",
            severity: "error",
            token: step.token,
            status: "missing",
            message: `Provider '${step.token}' is not registered. Resolution path: ${step.path.join(" -> ")}.`,
            path: step.path,
            trace,
            ...Container.getSourceLocationForTokenLabel(step.token),
          });
          continue;
        }

        if (step.status === "circular") {
          pushDiagnostic({
            code: "framework-context/di-circular-dependency",
            severity: "error",
            token: step.token,
            status: "circular",
            message: step.reason,
            path: step.path,
            trace,
            ...Container.getSourceLocationForTokenLabel(step.token),
          });
          continue;
        }

        if (step.status === "scope-mismatch") {
          pushDiagnostic({
            code: "framework-context/di-scope-mismatch",
            severity: "error",
            token: step.token,
            status: "scope-mismatch",
            message: step.reason,
            path: step.path,
            trace,
            ...Container.getSourceLocationForTokenLabel(step.token),
          });
          continue;
        }

        if (step.provider === "typedi") {
          pushDiagnostic({
            code: "framework-context/di-unknown-provider",
            severity: "error",
            token: step.token,
            status: "failed",
            message: `Provider '${step.token}' depends on TypeDI fallback metadata and cannot be statically verified.`,
            path: step.path,
            trace,
            ...Container.getSourceLocationForTokenLabel(step.token),
          });
        }
      }
    }

    return diagnostics.sort((left, right) => {
      const codeOrder = left.code.localeCompare(right.code);
      return codeOrder === 0 ? left.token.localeCompare(right.token) : codeOrder;
    });
  }

  private static getSourceLocationForTokenLabel(token: string): {
    readonly sourceLocation?: DependencySourceLocation;
  } {
    const component = Container.getRegisteredComponents().find(
      (candidate) => Container.describeToken(candidate).label === token,
    );
    const sourceLocation = component
      ? Container.componentSourceLocations.get(component)
      : undefined;

    return sourceLocation ? { sourceLocation } : {};
  }

  private static captureSourceLocation(): DependencySourceLocation | undefined {
    const stack = new Error().stack?.split("\n").slice(2) ?? [];

    for (const line of stack) {
      const trimmed = line.trim();
      const match = trimmed.match(/\(?((?:file:\/\/)?\/.*):(\d+):(\d+)\)?$/);
      if (!match) {
        continue;
      }

      const file = match[1]?.replace(/^file:\/\//, "");

      if (!file || file.includes("/packages/framework-context/src/libs/")) {
        continue;
      }

      return {
        file: Container.normalizeSourceFile(file),
        line: Number(match[2]),
        column: Number(match[3]),
      };
    }

    return undefined;
  }

  private static normalizeSourceFile(file: string): string {
    const normalizedFile = file.replace(/\\/g, "/");
    const cwd = process.cwd().replace(/\\/g, "/");
    const prefix = `${cwd}/`;

    return normalizedFile.startsWith(prefix) ? normalizedFile.slice(prefix.length) : normalizedFile;
  }

  static getComponentMetadata(target: Constructor): ComponentMetadata | undefined {
    return MetadataStorage.get(COMPONENT_METADATA_KEY, target);
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
    return {
      isInitialized: Container.validated,
      registeredServiceCount: components.length,
      scopes: Array.from(scopes),
      ...(Container.lastResolutionTrace
        ? { lastResolutionTrace: Container.lastResolutionTrace }
        : {}),
    };
  }

  private static shouldResolveLazy<T>(token: TokenIdentifier<T>): boolean {
    return Container.lazyProviders.has(token) && !Container.hasRegisteredValue(token);
  }

  private static resolveLazy<T>(token: TokenIdentifier<T>): T {
    const factory = Container.lazyProviders.get(token);
    if (!factory) {
      return Container.getRegisteredValue(token);
    }

    const instance = factory() as T;
    Container.set(token, instance);
    return instance;
  }

  private static resolveIdentifier<T>(
    token: TokenIdentifier<T>,
  ): Constructor<T> | TypeDIToken<T> | string {
    if (typeof token === "symbol") {
      return Container.getOrCreateSymbolToken(token) as TypeDIToken<T>;
    }

    return token;
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
    if (typeof token === "symbol") {
      return TypeDIContainer.get(Container.getOrCreateSymbolToken(token) as TypeDIToken<T>);
    }

    if (typeof token === "string") {
      return TypeDIContainer.get(token);
    }

    if (token instanceof TypeDIToken) {
      return TypeDIContainer.get(token);
    }

    return TypeDIContainer.get(Container.toTypeDIConstructable(token));
  }

  private static hasRegisteredValue<T>(token: TokenIdentifier<T>): boolean {
    if (typeof token === "symbol") {
      return TypeDIContainer.has(Container.getOrCreateSymbolToken(token));
    }

    if (typeof token === "string") {
      return TypeDIContainer.has(token);
    }

    if (token instanceof TypeDIToken) {
      return TypeDIContainer.has(token);
    }

    return TypeDIContainer.has(Container.toTypeDIConstructable(token));
  }

  private static removeRegisteredValue<T>(token: TokenIdentifier<T>): void {
    if (typeof token === "symbol") {
      TypeDIContainer.remove(Container.getOrCreateSymbolToken(token));
      return;
    }

    if (typeof token === "string") {
      TypeDIContainer.remove(token);
      return;
    }

    if (token instanceof TypeDIToken) {
      TypeDIContainer.remove(token);
      return;
    }

    TypeDIContainer.remove(Container.toTypeDIConstructable(token));
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
      return TypeDIContainer.get(Container.toTypeDIConstructable(constructorToken));
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
        return TypeDIContainer.get(Container.toTypeDIConstructable(constructorToken));
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

    return paramTypes.map((paramType: Constructor, index: number) => {
      Container.assertScopeCompatibility(paramType, stack, trace);

      const handler = TypeDIContainer.handlers.find(
        (candidate) =>
          (candidate.object === token || candidate.object === Object.getPrototypeOf(token)) &&
          candidate.index === index,
      );

      if (handler) {
        return handler.value(handlerContainer);
      }

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
    edge?: Pick<DependencyResolutionStep, "dependencyOf" | "parameterIndex">,
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
    paramTypes.forEach((paramType, parameterIndex) => {
      const injectedToken = getParameterInjectionToken(token, parameterIndex);
      Container.collectResolutionSteps(injectedToken ?? paramType, nextPath, steps, {
        dependencyOf: step.token,
        parameterIndex,
      });
    });
  }

  private static createResolutionStep<T>(
    token: TokenIdentifier<T>,
    path: TokenIdentifier<unknown>[],
    overrides: Partial<DependencyResolutionStep> = {},
  ): DependencyResolutionStep {
    const described = Container.describeToken(token);
    const selection = Container.describeProviderSelection(token);
    return {
      token: described.label,
      tokenKind: described.kind,
      provider: overrides.provider ?? selection.provider,
      status: overrides.status ?? selection.status,
      reason: overrides.reason ?? selection.reason,
      path: [...path, token as TokenIdentifier<unknown>].map(
        (entry) => Container.describeToken(entry).label,
      ),
      ...(selection.scope ? { scope: selection.scope } : {}),
      ...(overrides.dependencyOf ? { dependencyOf: overrides.dependencyOf } : {}),
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
    kind: DependencyTokenKind;
  } {
    if (typeof token === "string") {
      return { label: token, kind: "string" };
    }

    if (typeof token === "symbol") {
      return {
        label: Symbol.keyFor(token) ?? token.description ?? token.toString(),
        kind: "symbol",
      };
    }

    if (token instanceof TypeDIToken) {
      return { label: `Token<${token.name ?? "UNSET_NAME"}>`, kind: "typedi-token" };
    }

    return { label: token.name || "<anonymous>", kind: "constructor" };
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
