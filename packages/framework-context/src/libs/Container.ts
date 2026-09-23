import { AsyncLocalStorage } from "node:async_hooks";
import "reflect-metadata";
import { Problem, ProblemFactory } from "@croco/problems-core";
import { Context, trackRequestInstance } from "./Context";
import type {
  GeneratedDiGraph,
  GeneratedProviderDefinition,
  GeneratedProviderKind,
  GeneratedProviderResolver,
} from "./GeneratedGraph";
import { GENERATED_DI_GRAPH_VERSION } from "./GeneratedGraph";
import { inspectInjectionMetadata } from "./InjectionMetadata";
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
  InjectionInspection,
} from "./types";
import {
  type Constructable as RuntimeConstructable,
  type ServiceIdentifier,
  type ServiceMetadata,
  type ServiceOptions as Service,
  RuntimeContainer as RuntimeContainerBackend,
  type ContainerInstance as RuntimeContainerInstance,
  ServiceNotFoundError,
} from "./RuntimeContainer";
import { Token as CrocoToken, type TokenIdentifier as CrocoTokenIdentifier } from "./Token";

export type TokenIdentifier<T> = CrocoTokenIdentifier<T>;
type TokenIdentifierValue<TToken> = TToken extends TokenIdentifier<infer TValue> ? TValue : unknown;
export type ContainerValidationOptions = {
  readonly force?: boolean;
  readonly roots?: readonly Constructor[];
};

const COMPONENT_METADATA_KEY = Symbol("component:metadata");
let containerScopeCounter = 0;

type ContainerScopeState = {
  readonly componentRegistrationOrder: Map<Constructor, number>;
  readonly componentSourceLocations: Map<Constructor, DependencySourceLocation>;
  readonly components: Map<Constructor, ComponentMetadata>;
  readonly explicitComponentSourceLocations: Map<Constructor, DependencySourceLocation>;
  readonly generatedProviders: Map<
    TokenIdentifier<unknown>,
    readonly GeneratedProviderDefinition[]
  >;
  readonly generatedSingletons: Map<GeneratedProviderDefinition, unknown>;
  readonly generatedTransients: Set<object>;
  readonly installedGraphs: Map<string, GeneratedDiGraph>;
  readonly id: string;
  readonly instance: RuntimeContainerInstance;
  readonly lazyProviders: Map<TokenIdentifier<unknown>, () => unknown>;
  readonly symbolTokens: Map<symbol, CrocoToken<unknown>>;
  readonly tokenIdentityIds: Map<TokenIdentifier<unknown>, string>;
  readonly tokenIdentityOwners: Map<string, TokenIdentifier<unknown>>;
  readonly tokens: Set<TokenIdentifier<unknown>>;
  disposed: boolean;
  lastResolutionTrace?: DependencyResolutionTrace;
  nextComponentRegistrationOrder: number;
  validated: boolean;
};

type ContainerScopeServiceAccess = {
  readonly services: ServiceMetadata<unknown>[];
  readonly destroyServiceInstance: (
    service: ServiceMetadata<unknown>,
    disposedValues?: Set<unknown>,
  ) => void;
};

type ContainerScopeSnapshot = {
  readonly componentRegistrationOrder: Map<Constructor, number>;
  readonly componentSourceLocations: Map<Constructor, DependencySourceLocation>;
  readonly components: Map<Constructor, ComponentMetadata>;
  readonly explicitComponentSourceLocations: Map<Constructor, DependencySourceLocation>;
  readonly generatedProviders: Map<
    TokenIdentifier<unknown>,
    readonly GeneratedProviderDefinition[]
  >;
  readonly generatedSingletons: Map<GeneratedProviderDefinition, unknown>;
  readonly generatedTransients: Set<object>;
  readonly installedGraphs: Map<string, GeneratedDiGraph>;
  readonly lazyProviders: Map<TokenIdentifier<unknown>, () => unknown>;
  readonly symbolTokens: Map<symbol, CrocoToken<unknown>>;
  readonly tokenIdentityIds: Map<TokenIdentifier<unknown>, string>;
  readonly tokenIdentityOwners: Map<string, TokenIdentifier<unknown>>;
  readonly tokens: Set<TokenIdentifier<unknown>>;
  readonly services: readonly {
    readonly reference: ServiceMetadata<unknown>;
    readonly values: ServiceMetadata<unknown>;
  }[];
  readonly lastResolutionTrace?: DependencyResolutionTrace;
  readonly nextComponentRegistrationOrder: number;
  readonly validated: boolean;
};

const containerScopeStorage = new AsyncLocalStorage<ContainerScopeState>();
type ContainerScopeRollbackTransaction = {
  readonly state: ContainerScopeState;
  active: boolean;
};
const containerScopeRollbackStorage = new AsyncLocalStorage<ContainerScopeRollbackTransaction>();

type ContainerScopeCleanupFailure = {
  readonly phase: "dispose" | "rollback";
  readonly code:
    | "framework-context/container-scope-disposal-cleanup-failed"
    | "framework-context/container-scope-rollback-cleanup-failed";
  readonly message: string;
};

function createContainerScopeCleanupFailure(
  error: unknown,
  phase: ContainerScopeCleanupFailure["phase"],
): ContainerScopeCleanupFailure {
  return {
    phase,
    code:
      phase === "dispose"
        ? "framework-context/container-scope-disposal-cleanup-failed"
        : "framework-context/container-scope-rollback-cleanup-failed",
    message: error instanceof Error ? error.message : String(error),
  };
}

function destroyGeneratedInstance(instance: unknown): void {
  if (typeof instance !== "object" || instance === null) {
    return;
  }
  const disposable = instance as {
    [Symbol.dispose]?: () => void;
    destroy?: () => void;
  };
  const dispose = disposable[Symbol.dispose];
  if (typeof dispose === "function") {
    dispose.call(disposable);
    return;
  }
  disposable.destroy?.();
}

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
  private activeRollbackTransactions = 0;
  private rollbackTail: Promise<void> = Promise.resolve();

  constructor() {
    this.id = `croco-container-scope-${++containerScopeCounter}`;
    this.state = {
      componentRegistrationOrder: new Map(),
      componentSourceLocations: new Map(),
      components: new Map(),
      explicitComponentSourceLocations: new Map(),
      generatedProviders: new Map(Container.getGeneratedProviders()),
      generatedSingletons: new Map(),
      generatedTransients: new Set(),
      installedGraphs: new Map(Container.getInstalledGraphs()),
      id: this.id,
      instance: RuntimeContainerBackend.of(this.id),
      lazyProviders: new Map(),
      symbolTokens: new Map(),
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

  runWithRollback<T>(fn: () => Promise<T>): Promise<T> {
    const transaction = containerScopeRollbackStorage.getStore();
    if (transaction?.active && transaction.state === this.state) {
      return containerScopeStorage.run(this.state, fn);
    }

    const attempt = this.rollbackTail.then(() => this.executeWithRollback(fn));
    this.rollbackTail = attempt.then(
      () => undefined,
      () => undefined,
    );
    return attempt;
  }

  dispose(): void {
    if (this.state.disposed) {
      return;
    }

    if (this.activeRollbackTransactions > 0) {
      throw ProblemFactory.conflict(
        "framework-context/container-scope-transaction-active",
        `Container scope '${this.id}' cannot be disposed while rollback-protected work is active. Wait for the transaction to finish and dispose the scope again.`,
        { extensions: { scopeId: this.id, activeTransactions: this.activeRollbackTransactions } },
      );
    }

    this.state.disposed = true;
    this.state.componentRegistrationOrder.clear();
    this.state.componentSourceLocations.clear();
    this.state.components.clear();
    this.state.explicitComponentSourceLocations.clear();
    this.state.generatedProviders.clear();
    this.state.installedGraphs.clear();
    this.state.lazyProviders.clear();
    this.state.symbolTokens.clear();
    this.state.tokenIdentityIds.clear();
    this.state.tokenIdentityOwners.clear();
    this.state.tokens.clear();
    delete this.state.lastResolutionTrace;
    const access = this.getServiceAccess();
    const cleanupFailures: ContainerScopeCleanupFailure[] = [];
    const disposedValues = new Set<unknown>();
    try {
      for (const instance of [...this.state.generatedTransients].reverse()) {
        if (disposedValues.has(instance)) continue;
        disposedValues.add(instance);
        try {
          destroyGeneratedInstance(instance);
        } catch (error) {
          cleanupFailures.push(createContainerScopeCleanupFailure(error, "dispose"));
        }
      }
      this.state.generatedTransients.clear();
      for (const instance of [...this.state.generatedSingletons.values()].reverse()) {
        if (disposedValues.has(instance)) continue;
        disposedValues.add(instance);
        try {
          destroyGeneratedInstance(instance);
        } catch (error) {
          cleanupFailures.push(createContainerScopeCleanupFailure(error, "dispose"));
        }
      }
      this.state.generatedSingletons.clear();
      for (const service of access.services.slice()) {
        try {
          access.destroyServiceInstance(service, disposedValues);
        } catch (error) {
          cleanupFailures.push(createContainerScopeCleanupFailure(error, "dispose"));
        }
      }
    } finally {
      access.services.splice(0, access.services.length);
      RuntimeContainerBackend.reset(this.id);
    }

    if (cleanupFailures.length > 0) {
      throw ProblemFactory.internalServerError(
        "framework-context/container-scope-disposal-failed",
        `Container scope '${this.id}' was released after provider cleanup failed.`,
        { extensions: { cleanupFailures } },
      );
    }
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    this.dispose();
  }

  private createSnapshot(): ContainerScopeSnapshot {
    const services = this.getServiceAccess().services;

    return {
      componentRegistrationOrder: new Map(this.state.componentRegistrationOrder),
      componentSourceLocations: new Map(this.state.componentSourceLocations),
      components: new Map(this.state.components),
      explicitComponentSourceLocations: new Map(this.state.explicitComponentSourceLocations),
      generatedProviders: new Map(this.state.generatedProviders),
      generatedSingletons: new Map(this.state.generatedSingletons),
      generatedTransients: new Set(this.state.generatedTransients),
      installedGraphs: new Map(this.state.installedGraphs),
      lazyProviders: new Map(this.state.lazyProviders),
      symbolTokens: new Map(this.state.symbolTokens),
      tokenIdentityIds: new Map(this.state.tokenIdentityIds),
      tokenIdentityOwners: new Map(this.state.tokenIdentityOwners),
      tokens: new Set(this.state.tokens),
      services: services.map((service) => ({ reference: service, values: { ...service } })),
      ...(this.state.lastResolutionTrace
        ? { lastResolutionTrace: this.state.lastResolutionTrace }
        : {}),
      nextComponentRegistrationOrder: this.state.nextComponentRegistrationOrder,
      validated: this.state.validated,
    };
  }

  private restoreSnapshot(
    snapshot: ContainerScopeSnapshot,
  ): readonly ContainerScopeCleanupFailure[] {
    const access = this.getServiceAccess();
    const originalRecords = new Map(
      snapshot.services.map((record) => [record.reference, record.values]),
    );
    const cleanupFailures: ContainerScopeCleanupFailure[] = [];
    const retainedValues = new Set<unknown>([
      ...snapshot.generatedSingletons.values(),
      ...snapshot.generatedTransients,
      ...snapshot.services.map((record) => record.values.value),
    ]);
    const disposedValues = new Set<unknown>();

    for (const service of access.services) {
      const original = originalRecords.get(service);
      if ((!original || service.value !== original.value) && !retainedValues.has(service.value)) {
        try {
          access.destroyServiceInstance(service, disposedValues);
        } catch (error) {
          cleanupFailures.push(createContainerScopeCleanupFailure(error, "rollback"));
        }
      }
    }
    for (const [provider, instance] of this.state.generatedSingletons) {
      if (snapshot.generatedSingletons.get(provider) === instance) {
        continue;
      }
      if (retainedValues.has(instance) || disposedValues.has(instance)) continue;
      disposedValues.add(instance);
      try {
        destroyGeneratedInstance(instance);
      } catch (error) {
        cleanupFailures.push(createContainerScopeCleanupFailure(error, "rollback"));
      }
    }
    for (const instance of this.state.generatedTransients) {
      if (
        snapshot.generatedTransients.has(instance) ||
        retainedValues.has(instance) ||
        disposedValues.has(instance)
      ) {
        continue;
      }
      disposedValues.add(instance);
      try {
        destroyGeneratedInstance(instance);
      } catch (error) {
        cleanupFailures.push(createContainerScopeCleanupFailure(error, "rollback"));
      }
    }
    for (const { reference, values } of snapshot.services) {
      Object.assign(reference, values);
    }
    access.services.splice(
      0,
      access.services.length,
      ...snapshot.services.map(({ reference }) => reference),
    );

    this.replaceMap(this.state.componentRegistrationOrder, snapshot.componentRegistrationOrder);
    this.replaceMap(this.state.componentSourceLocations, snapshot.componentSourceLocations);
    this.replaceMap(this.state.components, snapshot.components);
    this.replaceMap(
      this.state.explicitComponentSourceLocations,
      snapshot.explicitComponentSourceLocations,
    );
    this.replaceMap(this.state.generatedProviders, snapshot.generatedProviders);
    this.replaceMap(this.state.generatedSingletons, snapshot.generatedSingletons);
    this.state.generatedTransients.clear();
    for (const instance of snapshot.generatedTransients)
      this.state.generatedTransients.add(instance);
    this.replaceMap(this.state.installedGraphs, snapshot.installedGraphs);
    this.replaceMap(this.state.lazyProviders, snapshot.lazyProviders);
    this.replaceMap(this.state.symbolTokens, snapshot.symbolTokens);
    this.replaceMap(this.state.tokenIdentityIds, snapshot.tokenIdentityIds);
    this.replaceMap(this.state.tokenIdentityOwners, snapshot.tokenIdentityOwners);
    this.state.tokens.clear();
    for (const token of snapshot.tokens) {
      this.state.tokens.add(token);
    }
    if (snapshot.lastResolutionTrace) {
      this.state.lastResolutionTrace = snapshot.lastResolutionTrace;
    } else {
      delete this.state.lastResolutionTrace;
    }
    this.state.nextComponentRegistrationOrder = snapshot.nextComponentRegistrationOrder;
    this.state.validated = snapshot.validated;
    return cleanupFailures;
  }

  private async executeWithRollback<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state.disposed) {
      throw createContainerScopeDisposedProblem(this.id);
    }

    this.activeRollbackTransactions += 1;
    try {
      const snapshot = this.createSnapshot();
      const transaction: ContainerScopeRollbackTransaction = { state: this.state, active: true };
      try {
        return await containerScopeRollbackStorage.run(transaction, () =>
          containerScopeStorage.run(this.state, fn),
        );
      } catch (error) {
        const cleanupFailures = this.restoreSnapshot(snapshot);
        if (cleanupFailures.length > 0) {
          throw ProblemFactory.internalServerError(
            "framework-context/container-scope-rollback-failed",
            `Container scope '${this.id}' could not cleanly roll back the failed transaction. Dispose this scope and create a new one.`,
            {
              ...(error instanceof Error ? { cause: error } : {}),
              extensions: { cleanupFailures },
            },
          );
        }
        throw error;
      } finally {
        transaction.active = false;
      }
    } finally {
      this.activeRollbackTransactions -= 1;
    }
  }

  private getServiceAccess(): ContainerScopeServiceAccess {
    const access = this.state.instance as unknown as Partial<ContainerScopeServiceAccess>;
    if (!Array.isArray(access.services) || typeof access.destroyServiceInstance !== "function") {
      throw ProblemFactory.internalServerError(
        "framework-context/container-scope-snapshot-unavailable",
        "Croco runtime 0.10.0 container metadata contract is unavailable for scoped rollback.",
      );
    }
    return access as ContainerScopeServiceAccess;
  }

  private replaceMap<TKey, TValue>(
    target: Map<TKey, TValue>,
    source: ReadonlyMap<TKey, TValue>,
  ): void {
    target.clear();
    for (const [key, value] of source) {
      target.set(key, value);
    }
  }
}

/**
 * Croco 컴포넌트의 등록, 조회, 지연 생성, 요청 스코프 해석을 담당하는 DI 컨테이너입니다.
 */
export class Container {
  private static validated = false;
  private static readonly lazyProviders = new Map<TokenIdentifier<unknown>, () => unknown>();
  private static readonly symbolTokens = new Map<symbol, CrocoToken<unknown>>();
  private static readonly componentSourceLocations = new Map<
    Constructor,
    DependencySourceLocation
  >();
  private static readonly explicitComponentSourceLocations = new Map<
    Constructor,
    DependencySourceLocation
  >();
  private static readonly componentRegistrationOrder = new Map<Constructor, number>();
  private static readonly generatedProviders = new Map<
    TokenIdentifier<unknown>,
    readonly GeneratedProviderDefinition[]
  >();
  private static readonly generatedSingletons = new Map<GeneratedProviderDefinition, unknown>();
  private static readonly generatedTransients = new Set<object>();
  private static readonly installedGraphs = new Map<string, GeneratedDiGraph>();
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

  static getMany<const TTokens extends readonly TokenIdentifier<unknown>[]>(
    tokens: TTokens,
  ): { -readonly [TIndex in keyof TTokens]: TokenIdentifierValue<TTokens[TIndex]> };
  static getMany<T>(token: TokenIdentifier<T>): T[];
  static getMany<T>(
    tokenOrTokens: TokenIdentifier<T> | readonly TokenIdentifier<unknown>[],
  ): unknown[] {
    if (Array.isArray(tokenOrTokens)) {
      return tokenOrTokens.map((token) => Container.get(token));
    }

    const token = tokenOrTokens as TokenIdentifier<T>;
    const trace = Container.buildResolutionTrace(token);
    try {
      const result = [...Container.resolveGeneratedMany(token, trace, [])];
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
      RuntimeContainerBackend.set({
        id: Container.toServiceIdentifier(token),
        value: instance,
      });
    }
    Container.getLazyProviders().delete(token);
    Container.setValidated(false);
    return instance;
  }

  static has<T>(token: TokenIdentifier<T>): boolean {
    return (
      Container.getGeneratedProviders().has(token) ||
      Container.getLazyProviders().has(token) ||
      Container.hasRegisteredValue(token)
    );
  }

  static createScope(): ContainerScope {
    return new ContainerScope();
  }

  static getActiveScopeId(): string | undefined {
    return Container.getScopeState()?.id;
  }

  /** @internal */
  static captureCurrentScopeRunner(): <T>(fn: () => T) => T {
    const state = Container.getScopeState();
    if (!state) {
      return <T>(fn: () => T): T => containerScopeStorage.exit(fn);
    }

    return <T>(fn: () => T): T => {
      if (state.disposed) {
        throw createContainerScopeDisposedProblem(state.id);
      }
      return containerScopeStorage.run(state, fn);
    };
  }

  /** @internal */
  static hasScopedComponent(target: Constructor): boolean {
    return Container.getScopeState()?.components.has(target) ?? false;
  }

  static inspectConstructorInjections(token: Constructor): readonly InjectionInspection[] {
    return Container.inspectInjections(token).filter(
      (inspection) => typeof inspection.parameterIndex === "number",
    );
  }

  static inspectInjections(token: Constructor): readonly InjectionInspection[] {
    const metadataInspections = [
      ...inspectInjectionMetadata(token),
      ...inspectInjectionMetadata(token.prototype),
    ];

    return metadataInspections.map((metadata): InjectionInspection => {
      const parameterIndex = metadata.index;
      const site =
        parameterIndex === undefined
          ? `property:${String(metadata.propertyKey)}`
          : `parameter:${parameterIndex}`;

      if (metadata.status === "resolved") {
        return {
          ...(parameterIndex === undefined ? {} : { parameterIndex }),
          optional: metadata.optional,
          site,
          status: "resolved",
          token: metadata.token,
        };
      }

      return {
        ...(parameterIndex === undefined ? {} : { parameterIndex }),
        optional: metadata.optional,
        site,
        status: "uninspectable",
      };
    });
  }

  static remove<T>(token: TokenIdentifier<T>): void {
    Container.removeRegisteredValue(token);
    Container.getLazyProviders().delete(token);
    Container.getGeneratedProviders().delete(token);
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
      const disposedValues = new Set<unknown>();
      scope.instance.reset({ strategy: "resetServices" }, disposedValues);
      Container.destroyGeneratedTransients(scope.generatedTransients, disposedValues);
      Container.destroyGeneratedSingletons(scope.generatedSingletons, disposedValues);
      scope.componentRegistrationOrder.clear();
      scope.componentSourceLocations.clear();
      scope.components.clear();
      scope.explicitComponentSourceLocations.clear();
      scope.generatedProviders.clear();
      scope.installedGraphs.clear();
      scope.lazyProviders.clear();
      scope.symbolTokens.clear();
      scope.tokenIdentityIds.clear();
      scope.tokenIdentityOwners.clear();
      scope.tokens.clear();
      delete scope.lastResolutionTrace;
      scope.nextComponentRegistrationOrder = 1;
      scope.validated = false;
      return;
    }

    const disposedValues = new Set<unknown>();
    RuntimeContainerBackend.of().reset({ strategy: "resetServices" }, disposedValues);
    Container.destroyGeneratedTransients(Container.generatedTransients, disposedValues);
    Container.destroyGeneratedSingletons(Container.generatedSingletons, disposedValues);
    // reset은 요청 처리가 없는 idle 시점에만 호출한다.
    MetadataStorage.clear();
    Container.lazyProviders.clear();
    Container.symbolTokens.clear();
    Container.componentSourceLocations.clear();
    Container.explicitComponentSourceLocations.clear();
    Container.generatedProviders.clear();
    Container.installedGraphs.clear();
    Container.componentRegistrationOrder.clear();
    Container.tokenIdentityIds.clear();
    Container.tokenIdentityOwners.clear();
    Container.lastResolutionTrace = undefined;
    Container.nextComponentRegistrationOrder = 1;
    Container.validated = false;
  }

  private static destroyGeneratedSingletons(
    singletons: Map<GeneratedProviderDefinition, unknown>,
    disposedValues = new Set<unknown>(),
  ): void {
    const failures: unknown[] = [];
    for (const instance of [...singletons.values()].reverse()) {
      if (disposedValues.has(instance)) continue;
      disposedValues.add(instance);
      try {
        destroyGeneratedInstance(instance);
      } catch (error) {
        failures.push(error);
      }
    }
    singletons.clear();
    if (failures.length > 0) {
      throw failures[0];
    }
  }

  private static destroyGeneratedTransients(
    transients: Set<object>,
    disposedValues: Set<unknown>,
  ): void {
    const failures: unknown[] = [];
    for (const instance of [...transients].reverse()) {
      if (disposedValues.has(instance)) continue;
      disposedValues.add(instance);
      try {
        destroyGeneratedInstance(instance);
      } catch (error) {
        failures.push(error);
      }
    }
    transients.clear();
    if (failures.length > 0) throw failures[0];
  }

  static validate(options: ContainerValidationOptions = {}): void {
    if (Container.isValidated()) {
      return;
    }

    if (!options.force && !Container.isValidationEnabled()) {
      return;
    }

    const nodes = options.roots
      ? Array.from(
          new Set([
            ...options.roots,
            ...(Container.getScopeState()?.components.keys() ?? []),
            ...[...Container.getGeneratedProviders().keys()].filter((token): token is Constructor =>
              Container.isConstructorToken(token),
            ),
          ]),
        )
      : Container.getRegisteredComponents();
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
      readonly knownProviders?: ReadonlySet<TokenIdentifier<unknown>>;
      readonly providerConstructors?: ReadonlyMap<TokenIdentifier<unknown>, Constructor<unknown>>;
      readonly rejectUnknownProviders?: boolean;
      readonly roots?: readonly TokenIdentifier<unknown>[];
    } = {},
  ): DependencyGraphManifest {
    const roots = [...(options.roots ?? Container.getRegisteredComponents())].sort((left, right) =>
      Container.compareTokens(left, right),
    );
    const traces = roots.map((root) =>
      Container.buildResolutionTrace(
        root,
        undefined,
        options.providerConstructors,
        options.knownProviders,
        options.rejectUnknownProviders,
      ),
    );
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

  static installGeneratedGraph(graph: GeneratedDiGraph): void {
    if (graph.version !== GENERATED_DI_GRAPH_VERSION) {
      throw ProblemFactory.badRequest(
        "framework-context/generated-di-graph-version-mismatch",
        `Unsupported generated DI graph version '${graph.version}'. Expected '${GENERATED_DI_GRAPH_VERSION}'.`,
      );
    }
    if (!graph.graphId || !graph.compilerVersion || !graph.inputHash) {
      throw ProblemFactory.badRequest(
        "framework-context/generated-di-graph-invalid",
        "Generated DI graphs require graphId, compilerVersion, and inputHash values.",
      );
    }

    const graphs = Container.getInstalledGraphs();
    const previous = graphs.get(graph.graphId);
    graphs.set(graph.graphId, graph);
    try {
      Container.rebuildGeneratedProviders();
    } catch (error) {
      if (previous) {
        graphs.set(graph.graphId, previous);
      } else {
        graphs.delete(graph.graphId);
      }
      Container.rebuildGeneratedProviders();
      throw error;
    }
    Container.setValidated(false);
  }

  static removeGeneratedGraph(graphId: string): void {
    if (!Container.getInstalledGraphs().delete(graphId)) {
      return;
    }
    Container.rebuildGeneratedProviders();
    Container.setValidated(false);
  }

  static getGeneratedProviderTokens(kind: GeneratedProviderKind): readonly Constructor[] {
    return [...Container.getGeneratedProviders().values()]
      .flat()
      .filter(
        (provider): provider is GeneratedProviderDefinition & { readonly token: Constructor } =>
          provider.kind === kind && Container.isConstructorToken(provider.token),
      )
      .map((provider) => provider.token);
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
    const configured = process.env["CROCO_DI_VALIDATE"];
    if (configured !== undefined) {
      return configured !== "0" && configured.toLowerCase() !== "false";
    }

    return process.env["NODE_ENV"] !== "production";
  }

  private static getRegisteredComponents(): Constructor[] {
    const registered = MetadataStorage.getAll<{ scope: Scope; target: Constructor }>(
      COMPONENT_METADATA_KEY,
    ).map((entry) => entry.target as Constructor);
    const scoped = Container.getScopeState()?.components.keys() ?? [];
    const generated = [...Container.getGeneratedProviders().keys()].filter(
      (token): token is Constructor => Container.isConstructorToken(token),
    );
    return Array.from(new Set([...registered, ...scoped, ...generated]));
  }

  private static buildDependencyGraph(nodes: Constructor[]): Map<Constructor, Constructor[]> {
    const nodeSet = new Set(nodes);
    const graph = new Map<Constructor, Constructor[]>();

    for (const node of nodes) {
      const dependencies: Constructor[] = [];
      const injections = new Map(
        Container.inspectConstructorInjections(node).map((inspection) => [
          inspection.parameterIndex,
          inspection,
        ]),
      );

      Container.getConstructorParameterIndices(node).forEach((parameterIndex) => {
        const inspection = injections.get(parameterIndex);
        const dependency = inspection?.status === "resolved" ? inspection.token : undefined;
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

        if (step.status === "uninspectable") {
          pushDiagnostic({
            code: "CROCO_DI_005",
            legacyCode: "framework-context/di-injection-handler-uninspectable",
            severity: "error",
            token: step.token,
            tokenId: step.tokenId,
            status: "failed",
            message: step.reason,
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
      (internalMatchFile.startsWith("src/tests/registerTestComponent") &&
        Container.isFrameworkContextPackageCwd()) ||
      internalMatchFile.startsWith("packages/framework-context/src/libs/") ||
      internalMatchFile.startsWith("packages/framework-context/src/tests/registerTestComponent") ||
      internalMatchFile.startsWith("packages/framework-context/dist/") ||
      internalMatchFile.includes("/packages/framework-context/src/libs/") ||
      internalMatchFile.includes("/packages/framework-context/src/tests/registerTestComponent") ||
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
    const metadata =
      Container.getScopeState()?.components.get(target) ??
      MetadataStorage.get<ComponentMetadata>(COMPONENT_METADATA_KEY, target);
    if (metadata) {
      return metadata;
    }
    const generated = Container.getGeneratedProviders().get(target)?.[0];
    return generated ? { scope: generated.scope, target } : undefined;
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

  /** @internal */
  static getGeneratedProviders(): Map<
    TokenIdentifier<unknown>,
    readonly GeneratedProviderDefinition[]
  > {
    return Container.getScopeState()?.generatedProviders ?? Container.generatedProviders;
  }

  /** @internal */
  static getInstalledGraphs(): Map<string, GeneratedDiGraph> {
    return Container.getScopeState()?.installedGraphs ?? Container.installedGraphs;
  }

  private static getGeneratedSingletons(): Map<GeneratedProviderDefinition, unknown> {
    return Container.getScopeState()?.generatedSingletons ?? Container.generatedSingletons;
  }

  private static getGeneratedTransients(): Set<object> {
    return Container.getScopeState()?.generatedTransients ?? Container.generatedTransients;
  }

  private static rebuildGeneratedProviders(): void {
    const providers = Container.getGeneratedProviders();
    const sourceLocations = Container.getComponentSourceLocations();
    Container.clearGeneratedProviderMetadata([...providers.values()].flat());
    providers.clear();

    const definitions = [...Container.getInstalledGraphs().values()]
      .sort((left, right) => left.graphId.localeCompare(right.graphId))
      .flatMap((graph) =>
        [...graph.providers].sort((left, right) => left.tokenId.localeCompare(right.tokenId)),
      );

    for (const provider of definitions) {
      Container.registerGeneratedTokenIdentity(provider.token, provider.tokenId);
      for (const dependency of provider.dependencies) {
        Container.registerGeneratedTokenIdentity(dependency.token, dependency.tokenId);
      }

      const existing = providers.get(provider.token) ?? [];
      if (existing.length > 0 && !provider.multiple && existing.some((entry) => !entry.multiple)) {
        throw ProblemFactory.conflict(
          "framework-context/generated-di-provider-conflict",
          `Generated DI token '${provider.debugName}' has multiple non-multi providers.`,
          { extensions: { tokenId: provider.tokenId } },
        );
      }
      providers.set(provider.token, [...existing, provider]);
      if (Container.isConstructorToken(provider.token)) {
        sourceLocations.set(provider.token, provider.sourceLocation);
      }
    }

    const activeDefinitions = new Set(definitions);
    const singletons = Container.getGeneratedSingletons();
    const retainedValues = new Set(
      [...singletons]
        .filter(([provider]) => activeDefinitions.has(provider))
        .map(([, value]) => value),
    );
    const disposedValues = new Set<unknown>();
    for (const [provider, instance] of singletons) {
      if (activeDefinitions.has(provider)) {
        continue;
      }
      singletons.delete(provider);
      if (retainedValues.has(instance) || disposedValues.has(instance)) continue;
      disposedValues.add(instance);
      destroyGeneratedInstance(instance);
    }
  }

  private static clearGeneratedProviderMetadata(
    definitions: readonly GeneratedProviderDefinition[],
  ): void {
    const tokenIdentityIds = Container.getTokenIdentityIds();
    const tokenIdentityOwners = Container.getTokenIdentityOwners();
    const sourceLocations = Container.getComponentSourceLocations();
    for (const definition of definitions) {
      const identities = [
        { token: definition.token, tokenId: definition.tokenId },
        ...definition.dependencies.map((dependency) => ({
          token: dependency.token,
          tokenId: dependency.tokenId,
        })),
      ];
      for (const identity of identities) {
        if (tokenIdentityIds.get(identity.token) !== identity.tokenId) {
          continue;
        }
        tokenIdentityIds.delete(identity.token);
        if (tokenIdentityOwners.get(identity.tokenId) === identity.token) {
          tokenIdentityOwners.delete(identity.tokenId);
        }
      }
      if (Container.isConstructorToken(definition.token)) {
        sourceLocations.delete(definition.token);
      }
    }
  }

  private static registerGeneratedTokenIdentity(
    token: TokenIdentifier<unknown>,
    tokenId: string,
  ): void {
    const tokenIdentityIds = Container.getTokenIdentityIds();
    const tokenIdentityOwners = Container.getTokenIdentityOwners();
    const existingOwner = tokenIdentityOwners.get(tokenId);
    if (existingOwner && existingOwner !== token) {
      throw ProblemFactory.conflict(
        "framework-context/generated-di-token-identity-conflict",
        `Generated DI token id '${tokenId}' is owned by more than one runtime token.`,
        { extensions: { tokenId } },
      );
    }
    const existingId = tokenIdentityIds.get(token);
    if (existingId && existingId !== tokenId) {
      tokenIdentityOwners.delete(existingId);
    }
    tokenIdentityIds.set(token, tokenId);
    tokenIdentityOwners.set(tokenId, token);
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

  private static getSymbolTokens(): Map<symbol, CrocoToken<unknown>> {
    return Container.getScopeState()?.symbolTokens ?? Container.symbolTokens;
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
   * Returns the Croco runtime identifier used internally for a Croco token.
   * Symbol mappings remain stable until {@link Container.reset}.
   */
  static toServiceIdentifier<T>(token: TokenIdentifier<T>): ServiceIdentifier<T> {
    if (typeof token === "symbol") {
      return Container.getOrCreateSymbolToken(token) as CrocoToken<T>;
    }

    return token as ServiceIdentifier<T>;
  }

  private static getOrCreateSymbolToken(symbol: symbol): CrocoToken<unknown> {
    const symbolTokens = Container.getSymbolTokens();
    const existing = symbolTokens.get(symbol);
    if (existing) {
      return existing;
    }

    const token = new CrocoToken(Symbol.keyFor(symbol) ?? symbol.description ?? symbol.toString());
    symbolTokens.set(symbol, token);
    return token;
  }

  private static isConstructorToken<T>(token: TokenIdentifier<T>): token is Constructor<T> {
    return typeof token === "function";
  }

  private static getRegisteredValue<T>(token: TokenIdentifier<T>): T {
    const scope = Container.getScopeState();
    if (scope && !Container.hasScopedValue(scope, token)) {
      throw new ServiceNotFoundError(Container.toServiceIdentifier(token));
    }

    const target = scope?.instance ?? RuntimeContainerBackend;
    if (typeof token === "symbol") {
      return target.get(Container.getOrCreateSymbolToken(token) as CrocoToken<T>);
    }

    if (typeof token === "string") {
      return target.get(token);
    }

    if (token instanceof CrocoToken) {
      return target.get(token);
    }

    return target.get(Container.toRuntimeConstructable(token));
  }

  private static setScopedValue<T>(
    container: RuntimeContainerInstance,
    token: TokenIdentifier<T>,
    instance: T,
  ): void {
    if (typeof token === "symbol") {
      container.set(Container.getOrCreateSymbolToken(token) as CrocoToken<T>, instance);
      return;
    }

    if (typeof token === "string") {
      container.set(token, instance);
      return;
    }

    if (token instanceof CrocoToken) {
      container.set(token, instance);
      return;
    }

    container.set(Container.toRuntimeConstructable(token), instance);
  }

  private static hasRegisteredValue<T>(token: TokenIdentifier<T>): boolean {
    const scope = Container.getScopeState();
    if (scope) {
      return Container.hasScopedValue(scope, token);
    }

    const target = RuntimeContainerBackend;
    if (typeof token === "symbol") {
      return target.has(Container.getOrCreateSymbolToken(token));
    }

    if (typeof token === "string") {
      return target.has(token);
    }

    if (token instanceof CrocoToken) {
      return target.has(token);
    }

    return target.has(Container.toRuntimeConstructable(token));
  }

  private static hasScopedValue<T>(scope: ContainerScopeState, token: TokenIdentifier<T>): boolean {
    const container = scope.instance as unknown as {
      has(identifier: ServiceIdentifier<T>): boolean;
    };
    return container.has(Container.toServiceIdentifier(token));
  }

  private static removeRegisteredValue<T>(token: TokenIdentifier<T>): void {
    const scope = Container.getScopeState();
    if (scope) {
      Container.removeScopedValue(scope.instance, token);
      scope.tokens.delete(token);
      return;
    }

    const target = RuntimeContainerBackend;
    if (typeof token === "symbol") {
      target.remove(Container.getOrCreateSymbolToken(token));
      return;
    }

    if (typeof token === "string") {
      target.remove(token);
      return;
    }

    if (token instanceof CrocoToken) {
      target.remove(token);
      return;
    }

    target.remove(Container.toRuntimeConstructable(token));
  }

  private static removeScopedValue<T>(
    container: RuntimeContainerInstance,
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

    if (token instanceof CrocoToken) {
      container.remove(token);
      return;
    }

    container.remove(Container.toRuntimeConstructable(token));
  }

  private static toRuntimeConstructable<T>(token: Constructor<T>): RuntimeConstructable<T> {
    return token as unknown as RuntimeConstructable<T>;
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

    if (Container.hasRegisteredValue(token)) {
      return Container.getRegisteredValue(token);
    }

    const generated = Container.getGeneratedProviders().get(token)?.[0] as
      | GeneratedProviderDefinition<T>
      | undefined;
    if (generated) {
      return Container.resolveGeneratedProvider(generated, trace, stack);
    }

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

  private static resolveGeneratedProvider<T>(
    provider: GeneratedProviderDefinition<T>,
    trace: DependencyResolutionTrace,
    stack: TokenIdentifier<unknown>[],
  ): T {
    Container.assertScopeCompatibility(provider.token, stack, trace);
    const singletons = Container.getGeneratedSingletons();
    if (provider.scope === "singleton" && singletons.has(provider)) {
      return singletons.get(provider) as T;
    }
    const requestCache = provider.scope === "request" ? Context.getCache() : undefined;
    if (provider.scope === "request" && !requestCache) {
      throw Container.createRequestScopeOutsideContextProblem();
    }
    const requestScope = Container.getScopeState() ?? Container;
    const requestInstances = requestCache?.get(provider) as
      | Map<ContainerScopeState | typeof Container, T>
      | undefined;
    if (requestInstances?.has(requestScope)) {
      return requestInstances.get(requestScope) as T;
    }

    const nextStack = [...stack, provider.token as TokenIdentifier<unknown>];
    const resolver: GeneratedProviderResolver = {
      get: (token) => Container.resolveWithTrace(token, trace, nextStack),
      getMany: (token) => Container.resolveGeneratedMany(token, trace, nextStack),
      getOptional: (token) => {
        try {
          return Container.resolveWithTrace(token, trace, nextStack);
        } catch (error) {
          if (Container.isOptionalResolutionError(error)) {
            return undefined;
          }
          throw error;
        }
      },
    };
    const instance = provider.factory(resolver);
    if (provider.scope === "singleton") {
      singletons.set(provider, instance);
    } else if (provider.scope === "request") {
      const instances = requestInstances ?? new Map<ContainerScopeState | typeof Container, T>();
      instances.set(requestScope, instance);
      requestCache?.set(provider, instances);
      if ((typeof instance === "object" && instance !== null) || typeof instance === "function") {
        trackRequestInstance(instance, () => destroyGeneratedInstance(instance));
      }
    } else if (
      (typeof instance === "object" && instance !== null) ||
      typeof instance === "function"
    ) {
      if (Context.getCache()) {
        trackRequestInstance(instance, () => destroyGeneratedInstance(instance));
      } else {
        Container.getGeneratedTransients().add(instance);
      }
    }
    return instance;
  }

  private static resolveGeneratedMany<T>(
    token: TokenIdentifier<T>,
    trace: DependencyResolutionTrace,
    stack: TokenIdentifier<unknown>[],
  ): readonly T[] {
    const generated = Container.getGeneratedProviders().get(token) as
      | readonly GeneratedProviderDefinition<T>[]
      | undefined;
    if (generated && generated.length > 0) {
      return generated.map((provider) =>
        Container.resolveGeneratedProvider(provider, trace, stack),
      );
    }
    return Container.resolveManyToken(token);
  }

  private static createTransientInstance<T>(
    token: Constructor<T>,
    trace: DependencyResolutionTrace,
    stack: TokenIdentifier<unknown>[],
  ): T {
    const dependencies = Container.resolveDependencies(token, trace, stack);
    const instance = Reflect.construct(token, dependencies) as T;
    Container.injectProperties(token, instance, trace, stack);
    return instance;
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
    const injections = inspectInjectionMetadata(token);

    return Container.getConstructorParameterIndices(token).map((index) => {
      const injection = injections.find((candidate) => candidate.index === index);
      if (injection?.status === "resolved") {
        const injectedToken = injection.token as TokenIdentifier<unknown>;
        if (injection.optional && !Container.has(injectedToken)) {
          return undefined;
        }
        Container.assertScopeCompatibility(injectedToken, stack, trace);
        return injection.many
          ? Container.resolveManyToken(injectedToken)
          : Container.resolveWithTrace(injectedToken, trace, stack);
      }

      const failureTrace = Container.withTraceStatus(trace, "missing");
      throw new ContainerResolutionProblem(
        `DI resolution failed for ${token.name}: constructor parameter ${index} has no generated dependency or explicit @Inject(...) token. Compile the application DI graph or register a factory-backed provider.`,
        failureTrace,
        "missing-provider",
      );
    });
  }

  private static injectProperties<T>(
    token: Constructor<T>,
    instance: T,
    trace: DependencyResolutionTrace,
    stack: TokenIdentifier<unknown>[],
  ): void {
    const injections = [
      ...inspectInjectionMetadata(token.prototype),
      ...inspectInjectionMetadata(token),
    ];
    for (const injection of injections) {
      if (injection.index !== undefined || injection.propertyKey === undefined) {
        continue;
      }
      if (injection.status !== "resolved") {
        throw new ContainerResolutionProblem(
          `DI resolution failed for ${token.name}: property '${String(injection.propertyKey)}' has no runtime token. Add an explicit @Inject(...) token.`,
          Container.withTraceStatus(trace, "missing"),
          "missing-provider",
        );
      }
      const injectedToken = injection.token as TokenIdentifier<unknown>;
      const value =
        injection.optional && !Container.has(injectedToken)
          ? undefined
          : injection.many
            ? Container.resolveManyToken(injectedToken)
            : Container.resolveWithTrace(injectedToken, trace, stack);
      Reflect.set(instance as object, injection.propertyKey, value);
    }
  }

  private static resolveManyToken<T>(token: TokenIdentifier<T>): T[] {
    const scope = Container.getScopeState();
    const target = scope?.instance ?? RuntimeContainerBackend.of();
    return target.getMany(Container.toServiceIdentifier(token));
  }

  private static buildResolutionTrace<T>(
    token: TokenIdentifier<T>,
    status?: DependencyResolutionTraceStatus,
    providerConstructors?: ReadonlyMap<TokenIdentifier<unknown>, Constructor<unknown>>,
    knownProviders?: ReadonlySet<TokenIdentifier<unknown>>,
    rejectUnknownProviders = false,
  ): DependencyResolutionTrace {
    const steps: DependencyResolutionStep[] = [];
    Container.collectResolutionSteps(
      token,
      [],
      steps,
      undefined,
      providerConstructors,
      knownProviders,
      rejectUnknownProviders,
    );
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
    providerConstructors?: ReadonlyMap<TokenIdentifier<unknown>, Constructor<unknown>>,
    knownProviders?: ReadonlySet<TokenIdentifier<unknown>>,
    rejectUnknownProviders = false,
  ): void {
    const nextPath = [...path, token as TokenIdentifier<unknown>];
    const cycleStartIndex = path.findIndex((entry) => Container.isSameToken(entry, token));

    if (cycleStartIndex >= 0) {
      steps.push(
        Container.createResolutionStep(
          token,
          path,
          {
            ...edge,
            status: "circular",
            reason: `Circular dependency detected through ${nextPath
              .slice(cycleStartIndex)
              .map((entry) => Container.describeToken(entry).label)
              .join(" -> ")}.`,
          },
          rejectUnknownProviders,
          providerConstructors?.has(token as TokenIdentifier<unknown>),
          knownProviders?.has(token as TokenIdentifier<unknown>),
        ),
      );
      return;
    }

    const scopeMismatch = Container.getScopeMismatch(token, path);
    if (scopeMismatch) {
      steps.push(
        Container.createResolutionStep(
          token,
          path,
          {
            ...edge,
            status: "scope-mismatch",
            reason: `Singleton-scoped component ${scopeMismatch.singleton} cannot depend on ${scopeMismatch.dependencyScope}-scoped component ${scopeMismatch.dependency}.`,
          },
          rejectUnknownProviders,
          providerConstructors?.has(token as TokenIdentifier<unknown>),
          knownProviders?.has(token as TokenIdentifier<unknown>),
        ),
      );
      return;
    }

    const step = Container.createResolutionStep(
      token,
      path,
      edge,
      rejectUnknownProviders,
      providerConstructors?.has(token as TokenIdentifier<unknown>),
      knownProviders?.has(token as TokenIdentifier<unknown>),
    );
    steps.push(step);

    const implementation =
      providerConstructors?.get(token as TokenIdentifier<unknown>) ??
      (Container.isConstructorToken(token) && step.provider === "component" ? token : undefined);
    const generatedProviders =
      Container.getGeneratedProviders().get(token) ??
      (implementation ? Container.getGeneratedProviders().get(implementation) : undefined) ??
      [];
    if (step.status === "selected" && generatedProviders.length > 0) {
      for (const provider of generatedProviders) {
        for (const dependency of provider.dependencies) {
          if (dependency.optional && !Container.has(dependency.token)) {
            continue;
          }
          Container.collectResolutionSteps(
            dependency.token,
            nextPath,
            steps,
            {
              dependencyOf: step.token,
              dependencyOfId: step.tokenId,
              ...(dependency.parameterIndex === undefined
                ? {}
                : { parameterIndex: dependency.parameterIndex }),
            },
            providerConstructors,
            knownProviders,
            rejectUnknownProviders,
          );
        }
      }
      return;
    }

    if (step.status !== "selected" || !implementation) {
      return;
    }

    const injectionInspections = new Map(
      Container.inspectConstructorInjections(implementation).map((inspection) => [
        inspection.parameterIndex,
        inspection,
      ]),
    );
    Container.getConstructorParameterIndices(implementation).forEach((parameterIndex) => {
      const injectionInspection = injectionInspections.get(parameterIndex);
      if (!injectionInspection || injectionInspection.status === "uninspectable") {
        steps.push(
          Container.createResolutionStep(
            implementation,
            path,
            {
              status: "uninspectable",
              reason: `Dependency '${implementation.name}' parameter ${parameterIndex} has no generated edge or statically inspectable @Inject token.`,
              parameterIndex,
            },
            rejectUnknownProviders,
            true,
          ),
        );
        return;
      }

      const dependency = injectionInspection.token as TokenIdentifier<unknown>;

      Container.collectResolutionSteps(
        dependency,
        nextPath,
        steps,
        {
          dependencyOf: step.token,
          dependencyOfId: step.tokenId,
          parameterIndex,
        },
        providerConstructors,
        knownProviders,
        rejectUnknownProviders,
      );
    });
  }

  private static getConstructorParameterIndices(token: Constructor): number[] {
    const parameterCount = inspectInjectionMetadata(token).reduce(
      (count, injection) =>
        injection.index === undefined ? count : Math.max(count, injection.index + 1),
      token.length,
    );

    return Array.from({ length: parameterCount }, (_, index) => index);
  }

  private static createResolutionStep<T>(
    token: TokenIdentifier<T>,
    path: TokenIdentifier<unknown>[],
    overrides: Partial<DependencyResolutionStep> = {},
    rejectUnknownProviders = false,
    knownProvider = false,
    knownLeafProvider = false,
  ): DependencyResolutionStep {
    const described = Container.describeToken(token);
    const selection = Container.describeProviderSelection(
      token,
      rejectUnknownProviders,
      knownProvider,
      knownLeafProvider,
    );
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

  private static describeProviderSelection<T>(
    token: TokenIdentifier<T>,
    rejectUnknownProviders = false,
    knownProvider = false,
    knownLeafProvider = false,
  ): {
    provider: DependencyProviderKind;
    status: DependencyResolutionStepStatus;
    reason: string;
    scope?: Scope;
  } {
    if (Container.hasRegisteredValue(token)) {
      const scope = Container.getTokenScope(token);
      return {
        provider: "registered-value",
        status: "selected",
        reason:
          "Explicit provider value overrides the generated factory in this application scope.",
        ...(scope === undefined ? {} : { scope }),
      };
    }
    const generated = Container.getGeneratedProviders().get(token)?.[0];
    if (generated) {
      return {
        provider: "component",
        status: "selected",
        reason: `Generated factory '${generated.tokenId}' selected ${generated.scope} scope.`,
        scope: generated.scope,
      };
    }
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

    if (knownLeafProvider) {
      return {
        provider: "registered-value",
        status: "selected",
        reason:
          "Application runtime value or factory provider is declared by the module lifecycle.",
      };
    }

    if (knownProvider) {
      return {
        provider: "component",
        status: "selected",
        reason: "Application runtime class provider is registered by the module lifecycle.",
      };
    }

    return {
      provider: "missing",
      status: "missing",
      reason: "No generated or explicitly registered provider exists for this token.",
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
    if (steps.some((step) => step.status === "uninspectable")) {
      return "failed";
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

    if (Container.isRuntimeResolutionError(error)) {
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
    const reason = Container.isRuntimeResolutionError(error)
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
      scopeMismatch.dependency,
      scopeMismatch.path,
      Container.withTraceStatus(trace, "scope-mismatch"),
      scopeMismatch.dependencyScope,
    );
  }

  private static getScopeMismatch<T>(
    token: TokenIdentifier<T>,
    path: TokenIdentifier<unknown>[],
  ):
    | {
        singleton: string;
        dependency: string;
        dependencyScope: "request" | "transient";
        path: string[];
      }
    | undefined {
    const dependencyScope = Container.getTokenScope(token);
    if (dependencyScope !== "request" && dependencyScope !== "transient") {
      return undefined;
    }

    const singletonAncestor = path.find((entry) => Container.getTokenScope(entry) === "singleton");

    if (!singletonAncestor) {
      return undefined;
    }

    return {
      singleton: Container.describeToken(singletonAncestor).label,
      dependency: Container.describeToken(token).label,
      dependencyScope,
      path: [...path, token as TokenIdentifier<unknown>].map(
        (entry) => Container.describeToken(entry).label,
      ),
    };
  }

  private static getTokenScope<T>(token: TokenIdentifier<T>): Scope | undefined {
    const generated = Container.getGeneratedProviders().get(token)?.[0];
    if (generated) {
      return generated.scope;
    }
    return Container.isConstructorToken(token)
      ? Container.getComponentMetadata(token)?.scope
      : undefined;
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

    if (token instanceof CrocoToken) {
      const label = `Token<${token.name ?? "UNSET_NAME"}>`;
      return {
        label,
        id: Container.getTokenId(token, "token", label),
        kind: "token",
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

  private static isRuntimeResolutionError(error: unknown): error is Error {
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
      throw Container.createRequestScopeOutsideContextProblem();
    }

    const cached = cache.get(token);
    if (cached !== undefined) {
      return cached as T;
    }

    const instance = Container.createTransientInstance(token, trace, stack);
    cache.set(token, instance);
    return instance;
  }

  private static createRequestScopeOutsideContextProblem(): Problem {
    return ProblemFactory.internalServerError(
      "framework-context/request-scope-outside-context",
      "Request-scoped dependencies must be resolved inside Context.run().",
    );
  }
}

export type { Service };
