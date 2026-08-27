import { Container, ServiceNotFoundError } from "typedi";
import type {
  Constructable,
  ContainerInstance,
  Handler,
  ServiceIdentifier,
  ServiceMetadata,
} from "typedi";
import "reflect-metadata";
import { Container as FrameworkContainer } from "@croco/framework-context";
import { detectCircularDependency } from "./CircularDependencyDetector";
import { ModuleContext } from "./ModuleContext";
import { getModuleTokenLabel } from "./moduleTokenLabels";
import { getProviderToken, isConstructorToken, isProviderDefinition } from "./moduleTokens";
import {
  attachModuleCleanupFailures,
  InvalidModuleDefinitionProblem,
  formatModuleProviderOwnershipDetail,
  ModuleCircularDependencyProblem,
  ModuleDuplicateNameProblem,
  ModuleLifecycleProblem,
  ModuleProviderOwnershipProblem,
  ModuleProviderUnavailableProblem,
  ModuleProviderVisibilityProblem,
  ModuleProviderWriteProblem,
  ModuleRegistrationConflictProblem,
  ModuleRuntimeDisposedProblem,
  ModuleRuntimeResetConflictProblem,
  ModuleRuntimeStaleContextProblem,
} from "./problems";
import type {
  ModuleCleanupFailure,
  ModuleGraphDiagnostic,
  ModuleGraphManifest,
  ModuleGraphModule,
  ModuleGraphProvider,
  ModuleDiagnosticsSnapshot,
  ModuleLifecyclePhase,
  ModuleOptions,
  ModuleProvider,
  ModuleProviderDefinition,
  ModuleRuntimePhase,
} from "./types";
import type { Constructor, ModuleToken } from "./types/ModuleToken";

type CrocoModuleInternal = ModuleOptions;

type ModuleRuntimeState = {
  readonly module: ModuleOptions;
  phase: ModuleRuntimePhase;
  initialized: boolean;
  lastError?: string;
  cleanupFailures?: readonly ModuleCleanupFailure[];
  readonly providers: Set<ModuleToken<unknown>>;
  readonly exports: Set<ModuleToken<unknown>>;
  readonly controllers: Set<ModuleToken<unknown>>;
  readonly classProviders: Map<ModuleToken<unknown>, Constructor<unknown>>;
};

type ContainerServiceMetadataAccess = {
  readonly services: ServiceMetadata<unknown>[];
  readonly destroyServiceInstance: (service: ServiceMetadata<unknown>) => void;
  readonly getServiceValue: <T>(service: ServiceMetadata<T>) => T;
};

type ContainerServiceMetadataRecordSnapshot = {
  readonly reference: ServiceMetadata<unknown>;
  readonly values: ServiceMetadata<unknown>;
};

type ContainerServiceMetadataSnapshot = {
  readonly originalOrder: readonly ServiceMetadata<unknown>[];
  readonly affectedIdentifiers: ReadonlySet<ServiceIdentifier<unknown>>;
  readonly affectedRecords: readonly ContainerServiceMetadataRecordSnapshot[];
};

type ModuleProviderVisibilityFailure = {
  readonly moduleName: string;
  readonly providerClass: Constructor<unknown>;
  readonly token: ModuleToken<unknown>;
};

type ModuleProviderOwnershipConflict = {
  readonly token: ModuleToken<unknown>;
  readonly owners: readonly string[];
};

type ModuleRegistryState = {
  readonly registeredModules: Map<string, CrocoModuleInternal>;
  readonly moduleSources: WeakMap<ModuleOptions, ModuleOptions>;
  readonly moduleStates: Map<string, ModuleRuntimeState>;
  readonly container: ContainerInstance;
  readonly containerId?: string;
  readonly rejectGlobalProviderFallback: boolean;
  isInitialized: boolean;
  initializedModules: ModuleOptions[];
  activeContext: ModuleContext | null;
  initializationPromise: Promise<ModuleContext> | null;
  shutdownPromise: Promise<void> | null;
  isInitializing: boolean;
  activeShutdownOperations: number;
  registryGeneration: number;
  disposed: boolean;
  disposePromise: Promise<void> | null;
};

class CapturedTypediInjectionToken extends Error {
  constructor(readonly token: ModuleToken<unknown>) {
    super("Captured TypeDI injection token");
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const IGNORED_CONSTRUCTOR_DEPENDENCIES = new Set<unknown>([
  Array,
  Boolean,
  Number,
  Object,
  Promise,
  String,
]);
let moduleRuntimeSequence = 0;
export interface ModuleRuntime extends AsyncDisposable {
  use(module: ModuleOptions): void;
  initialize(): Promise<ModuleContext>;
  shutdown(): Promise<void>;
  reset(): void;
  dispose(): Promise<void>;
  createGraphManifest(): ModuleGraphManifest;
  getRegisteredModules(): readonly ModuleDiagnosticsSnapshot[];
}

class ModuleRuntimeImplementation implements ModuleRuntime {
  constructor(private readonly state: ModuleRegistryState) {}

  use(module: ModuleOptions): void {
    assertRuntimeAvailable(this.state);
    registerModuleInState(this.state, module);
  }

  initialize(): Promise<ModuleContext> {
    try {
      assertRuntimeAvailable(this.state);
      return initializeModulesInState(this.state);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  shutdown(): Promise<void> {
    try {
      assertRuntimeAvailable(this.state);
      return shutdownModulesInState(this.state);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  reset(): void {
    assertRuntimeAvailable(this.state);
    assertRuntimeResetAvailable(this.state);
    resetModulesInState(this.state);
  }

  async dispose(): Promise<void> {
    if (this.state.disposed) {
      return;
    }

    if (!this.state.disposePromise) {
      this.state.disposePromise = disposeModuleRuntime(this.state);
    }

    await this.state.disposePromise;
  }

  createGraphManifest(): ModuleGraphManifest {
    assertRuntimeAvailable(this.state);
    return createModuleGraphManifestInState(this.state);
  }

  getRegisteredModules(): readonly ModuleDiagnosticsSnapshot[] {
    assertRuntimeAvailable(this.state);
    return getRegisteredModulesInState(this.state);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }
}

function createModuleRegistryState(containerId?: string): ModuleRegistryState {
  const container = Container.of(containerId);
  if (containerId) {
    makeContainerResolutionRuntimeLocal(container);
  }

  return {
    registeredModules: new Map(),
    moduleSources: new WeakMap(),
    moduleStates: new Map(),
    container,
    ...(containerId ? { containerId } : {}),
    rejectGlobalProviderFallback: Boolean(containerId),
    isInitialized: false,
    initializedModules: [],
    activeContext: null,
    initializationPromise: null,
    shutdownPromise: null,
    isInitializing: false,
    activeShutdownOperations: 0,
    registryGeneration: 0,
    disposed: false,
    disposePromise: null,
  };
}

const defaultModuleRuntimeState = createModuleRegistryState();
export const defaultModuleRuntime: ModuleRuntime = new ModuleRuntimeImplementation(
  defaultModuleRuntimeState,
);

export function createModuleRuntime(): ModuleRuntime {
  const containerId = `croco-module-runtime-${++moduleRuntimeSequence}`;
  return new ModuleRuntimeImplementation(createModuleRegistryState(containerId));
}

function assertRuntimeAvailable(state: ModuleRegistryState): void {
  if (state.disposed || state.disposePromise) {
    throw new ModuleRuntimeDisposedProblem();
  }
}

function assertRuntimeResetAvailable(state: ModuleRegistryState): void {
  if (!state.rejectGlobalProviderFallback) {
    return;
  }
  if (state.activeShutdownOperations > 0) {
    throw new ModuleRuntimeResetConflictProblem("shutting-down");
  }
  if (state.isInitializing) {
    throw new ModuleRuntimeResetConflictProblem("initializing");
  }
}

function assertRuntimeContextAvailable(
  state: ModuleRegistryState,
  expectedGeneration: number,
): void {
  if (state.disposed) {
    throw new ModuleRuntimeDisposedProblem();
  }

  if (state.registryGeneration !== expectedGeneration) {
    throw new ModuleRuntimeStaleContextProblem();
  }
}

async function disposeModuleRuntime(state: ModuleRegistryState): Promise<void> {
  try {
    await shutdownModulesInState(state);
  } finally {
    try {
      resetModulesInState(state);
      if (state.containerId) {
        Container.reset(state.containerId);
      }
    } finally {
      state.disposed = true;
    }
  }
}

export function registerModule(module: ModuleOptions): void {
  defaultModuleRuntime.use(module);
}

function registerModuleInState(state: ModuleRegistryState, module: ModuleOptions): void {
  const conflictState = getRegistrationConflictState(state);
  if (conflictState) {
    throw new ModuleRegistrationConflictProblem(conflictState);
  }

  const [snapshot] = collectModules([module], state.moduleSources);
  if (!snapshot) {
    throw new InvalidModuleDefinitionProblem("Module graph must contain a root module.");
  }

  const existing = state.registeredModules.get(snapshot.name);
  if (
    existing &&
    getModuleSource(existing, state.moduleSources) !==
      getModuleSource(snapshot, state.moduleSources)
  ) {
    throw new ModuleDuplicateNameProblem(
      snapshot.name,
      [`${existing.name} (previously registered)`],
      [`${snapshot.name} (newly registered)`],
    );
  }

  state.registeredModules.set(snapshot.name, snapshot);
  state.moduleStates.set(snapshot.name, createModuleState(snapshot));
  state.isInitialized = false;
}

export function initializeModules(): Promise<ModuleContext> {
  return defaultModuleRuntime.initialize();
}

function initializeModulesInState(state: ModuleRegistryState): Promise<ModuleContext> {
  if (state.isInitialized && state.activeContext) {
    return Promise.resolve(state.activeContext);
  }

  if (state.initializationPromise) {
    return state.initializationPromise;
  }

  state.isInitializing = true;
  const attempt = performInitializeModules(state);
  state.initializationPromise = attempt;
  void attempt.then(
    () => clearInitializationPromise(state, attempt),
    () => clearInitializationPromise(state, attempt),
  );
  return attempt;
}

async function performInitializeModules(state: ModuleRegistryState): Promise<ModuleContext> {
  const attemptGeneration = state.registryGeneration;
  const modules = collectModules(Array.from(state.registeredModules.values()), state.moduleSources);
  detectCircularDependency(modules);
  assertUnambiguousProviderOwnership(modules);

  const sortedModules = sortModules(modules);
  const container = state.container;
  const context = createRootContext(state, container);
  const containerSnapshot = snapshotContainerServices(container, sortedModules);
  const compensationStack: ModuleOptions[] = [];

  state.moduleStates.clear();
  for (const module of sortedModules) {
    state.moduleStates.set(module.name, createModuleState(module));
  }

  try {
    for (const module of sortedModules) {
      compensationStack.push(module);
      const moduleContext = createModuleContext(state, module.name, container);
      await runLifecycle(state, module, "setup", async () => {
        await registerProviders(state, module, moduleContext, container);
        await module.setup?.(moduleContext);
      });
    }

    for (const module of sortedModules) {
      const moduleContext = createModuleContext(state, module.name, container);
      await runLifecycle(state, module, "start", async () => {
        await module.start?.(moduleContext);
      });

      const moduleState = state.moduleStates.get(module.name);
      if (moduleState) {
        moduleState.phase = "started";
        moduleState.initialized = true;
        moduleState.lastError = undefined;
        moduleState.cleanupFailures = undefined;
      }
    }

    if (state.registryGeneration !== attemptGeneration) {
      throw new ModuleLifecycleProblem(
        "<registry>",
        "setup",
        new Error("Module registry was reset during initialization."),
      );
    }
  } catch (error) {
    const cleanupFailures = await compensateInitialization(
      state,
      compensationStack,
      container,
      error,
    );
    restoreContainerServices(container, containerSnapshot);
    resetActiveRuntimeState(state);

    if (error instanceof ModuleLifecycleProblem) {
      throw attachModuleCleanupFailures(error, cleanupFailures);
    }
    throw error;
  }

  state.isInitialized = true;
  state.initializedModules = sortedModules;
  state.activeContext = context;
  return context;
}

export async function shutdownModules(): Promise<void> {
  await defaultModuleRuntime.shutdown();
}

async function shutdownModulesInState(state: ModuleRegistryState): Promise<void> {
  if (state.shutdownPromise) {
    return state.shutdownPromise;
  }

  state.activeShutdownOperations += 1;
  const attempt = performShutdownModules(state);
  state.shutdownPromise = attempt;
  try {
    await attempt;
  } finally {
    if (state.shutdownPromise === attempt) {
      state.shutdownPromise = null;
      state.activeShutdownOperations -= 1;
    }
  }
}

async function performShutdownModules(state: ModuleRegistryState): Promise<void> {
  if (state.initializationPromise) {
    try {
      await state.initializationPromise;
    } catch {
      return;
    }
  }

  if (!state.activeContext) {
    return;
  }

  const modules = [...state.initializedModules].reverse();
  const container = state.container;
  const cleanupFailures: ModuleCleanupFailure[] = [];
  let firstFailure: ModuleLifecycleProblem | undefined;

  try {
    for (const module of modules) {
      try {
        const moduleContext = createModuleContext(state, module.name, container);
        await runLifecycle(state, module, "shutdown", async () => {
          await module.shutdown?.(moduleContext);
        });

        const moduleState = state.moduleStates.get(module.name);
        if (moduleState) {
          moduleState.phase = "stopped";
          moduleState.initialized = false;
          moduleState.lastError = undefined;
          moduleState.cleanupFailures = undefined;
        }
      } catch (error) {
        const problem =
          error instanceof ModuleLifecycleProblem
            ? error
            : new ModuleLifecycleProblem(module.name, "shutdown", error);
        const failure = createModuleCleanupFailure(problem, module.name);
        cleanupFailures.push(failure);
        firstFailure ??= problem;

        const moduleState = state.moduleStates.get(module.name);
        if (moduleState) {
          moduleState.cleanupFailures = [failure];
        }
      }
    }
  } finally {
    resetActiveRuntimeState(state);
  }

  if (firstFailure) {
    throw attachModuleCleanupFailures(firstFailure, cleanupFailures);
  }
}

export function resetModules(): void {
  defaultModuleRuntime.reset();
}

function resetModulesInState(state: ModuleRegistryState): void {
  state.registryGeneration += 1;
  state.registeredModules.clear();
  state.moduleStates.clear();
  state.isInitialized = false;
  state.isInitializing = false;
  state.initializedModules = [];
  state.activeContext = null;
  if (state.containerId) {
    state.container.reset({ strategy: "resetServices" });
  }
}

export function isModuleInitialized(): boolean {
  return defaultModuleRuntimeState.isInitialized;
}

export function getRegisteredModules(): readonly ModuleDiagnosticsSnapshot[] {
  return defaultModuleRuntime.getRegisteredModules();
}

function getRegisteredModulesInState(
  state: ModuleRegistryState,
): readonly ModuleDiagnosticsSnapshot[] {
  return Array.from(state.moduleStates.values()).map((moduleState) => ({
    name: moduleState.module.name,
    initialized: moduleState.initialized,
    phase: moduleState.phase,
    imports: moduleState.module.imports?.map((module) => module.name) ?? [],
    providers: Array.from(moduleState.providers).map(getModuleTokenLabel),
    exports: Array.from(moduleState.exports).map(getModuleTokenLabel),
    controllers: Array.from(moduleState.controllers).map(getModuleTokenLabel),
    lastError: moduleState.lastError,
    cleanupFailures: moduleState.cleanupFailures,
  }));
}

function clearInitializationPromise(
  state: ModuleRegistryState,
  attempt: Promise<ModuleContext>,
): void {
  if (state.initializationPromise === attempt) {
    state.initializationPromise = null;
    state.isInitializing = false;
  }
}

function getRegistrationConflictState(
  state: ModuleRegistryState,
): "initialized" | "initializing" | "shutting-down" | undefined {
  if (state.activeShutdownOperations > 0) {
    return "shutting-down";
  }
  if (state.isInitializing) {
    return "initializing";
  }
  if (state.isInitialized || state.activeContext) {
    return "initialized";
  }
  return undefined;
}

async function compensateInitialization(
  registryState: ModuleRegistryState,
  modules: readonly ModuleOptions[],
  container: ContainerInstance,
  primaryError: unknown,
): Promise<ModuleCleanupFailure[]> {
  const failures: ModuleCleanupFailure[] = [];
  const primaryModuleName =
    primaryError instanceof ModuleLifecycleProblem &&
    typeof primaryError.extensions?.moduleName === "string"
      ? primaryError.extensions.moduleName
      : undefined;

  for (const module of [...modules].reverse()) {
    const moduleState = registryState.moduleStates.get(module.name);
    if (moduleState) {
      moduleState.phase = "rollback";
      moduleState.initialized = false;
    }

    try {
      await module.shutdown?.(createModuleContext(registryState, module.name, container));
      if (moduleState) {
        moduleState.phase = "stopped";
      }
    } catch (error) {
      const problem = new ModuleLifecycleProblem(module.name, "shutdown", error);
      const failure = createModuleCleanupFailure(problem, module.name);
      failures.push(failure);
      if (moduleState) {
        moduleState.phase = "failed";
        if (module.name !== primaryModuleName) {
          moduleState.lastError = problem.message;
        }
        moduleState.cleanupFailures = [failure];
      }
    }
  }

  return failures;
}

function createModuleCleanupFailure(
  problem: ModuleLifecycleProblem,
  moduleName: string,
): ModuleCleanupFailure {
  return {
    moduleName,
    phase: "shutdown",
    code: problem.code,
    message: problem.message,
  };
}

function resetActiveRuntimeState(state: ModuleRegistryState): void {
  state.isInitialized = false;
  state.initializedModules = [];
  state.activeContext = null;
}

function snapshotContainerServices(
  container: ContainerInstance,
  modules: readonly ModuleOptions[],
): ContainerServiceMetadataSnapshot {
  const services = getContainerServices(container);
  const affectedIdentifiers = new Set<ServiceIdentifier<unknown>>();
  for (const module of modules) {
    for (const provider of module.providers ?? []) {
      affectedIdentifiers.add(
        FrameworkContainer.toTypeDIServiceIdentifier(getProviderToken(provider)),
      );
    }
  }

  return {
    originalOrder: [...services],
    affectedIdentifiers,
    affectedRecords: services
      .filter((service) => affectedIdentifiers.has(service.id))
      .map((service) => ({ reference: service, values: { ...service } })),
  };
}

function restoreContainerServices(
  container: ContainerInstance,
  snapshot: ContainerServiceMetadataSnapshot,
): void {
  const services = getContainerServices(container);
  const originalRecords = new Map(
    snapshot.affectedRecords.map((record) => [record.reference, record]),
  );
  const currentAffectedRecords = services.filter((service) =>
    snapshot.affectedIdentifiers.has(service.id),
  );

  for (const service of currentAffectedRecords) {
    const original = originalRecords.get(service);
    if (!original || service.value !== original.values.value) {
      destroyContainerService(container, service);
    }
  }

  for (const { reference, values } of snapshot.affectedRecords) {
    Object.assign(reference, values);
  }

  const originalServices = new Set(snapshot.originalOrder);
  const currentUnrelatedRecords = services.filter(
    (service) => !snapshot.affectedIdentifiers.has(service.id),
  );
  const survivingUnrelatedRecords = new Set(currentUnrelatedRecords);
  const restoredOrder = snapshot.originalOrder.filter(
    (service) =>
      snapshot.affectedIdentifiers.has(service.id) || survivingUnrelatedRecords.has(service),
  );
  restoredOrder.push(
    ...currentUnrelatedRecords.filter((service) => !originalServices.has(service)),
  );
  services.splice(0, services.length, ...restoredOrder);
}

function getContainerServices(container: ContainerInstance): ServiceMetadata<unknown>[] {
  return getContainerServiceMetadataAccess(container).services;
}

function makeContainerResolutionRuntimeLocal(container: ContainerInstance): void {
  container.get = <T>(identifier: ServiceIdentifier<T>): T => {
    const service = getContainerServices(container).find(
      (candidate) => candidate.id === identifier,
    );
    if (!service) {
      throw new ServiceNotFoundError(identifier);
    }

    return resolveContainerService(container, service as ServiceMetadata<T>);
  };

  container.getMany = <T>(identifier: ServiceIdentifier<T>): T[] =>
    getContainerServices(container)
      .filter((service) => service.id === identifier)
      .map((service) => resolveContainerService(container, service as ServiceMetadata<T>));
}

function resolveContainerService<T>(container: ContainerInstance, service: ServiceMetadata<T>): T {
  const initialValue = service.value;
  try {
    return getContainerServiceMetadataAccess(container).getServiceValue(service);
  } catch (error) {
    if (service.value !== initialValue) {
      destroyContainerService(container, service);
      service.value = initialValue;
    }
    throw error;
  }
}

function destroyContainerService(
  container: ContainerInstance,
  service: ServiceMetadata<unknown>,
): void {
  getContainerServiceMetadataAccess(container).destroyServiceInstance(service);
}

function getContainerServiceMetadataAccess(
  container: ContainerInstance,
): ContainerServiceMetadataAccess {
  const candidate = container as unknown as Partial<ContainerServiceMetadataAccess>;
  if (
    !Array.isArray(candidate.services) ||
    typeof candidate.destroyServiceInstance !== "function" ||
    typeof candidate.getServiceValue !== "function"
  ) {
    throw new ModuleLifecycleProblem(
      "<registry>",
      "setup",
      "TypeDI 0.10.0 container metadata contract is unavailable.",
    );
  }

  return candidate as ContainerServiceMetadataAccess;
}

export function createModuleGraphManifest(
  rootModules: readonly ModuleOptions[] = Array.from(
    defaultModuleRuntimeState.registeredModules.values(),
  ),
): ModuleGraphManifest {
  return createModuleGraphManifestInState(defaultModuleRuntimeState, rootModules);
}

function createModuleGraphManifestInState(
  state: ModuleRegistryState,
  rootModules: readonly ModuleOptions[] = Array.from(state.registeredModules.values()),
): ModuleGraphManifest {
  const modules = collectModules(rootModules, state.moduleSources);
  const states = new Map(modules.map((module) => [module.name, createModuleState(module)]));
  const diagnostics = createModuleGraphDiagnostics(
    modules,
    states,
    state.rejectGlobalProviderFallback,
  );

  return {
    version: "croco.module-graph.manifest.v1",
    status: diagnostics.length === 0 ? "ready" : "failed",
    modules: modules
      .map(createModuleGraphModule)
      .sort((left, right) => left.name.localeCompare(right.name)),
    diagnostics,
  };
}

export function stringifyModuleGraphManifest(manifest: ModuleGraphManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function validateModule(module: ModuleOptions): void {
  if (typeof module.name !== "string" || module.name.trim().length === 0) {
    throw new InvalidModuleDefinitionProblem("Module name must be a non-empty string.");
  }

  if (
    !module.setup &&
    !module.start &&
    !module.shutdown &&
    (module.imports?.length ?? 0) === 0 &&
    (module.providers?.length ?? 0) === 0 &&
    (module.exports?.length ?? 0) === 0 &&
    (module.controllers?.length ?? 0) === 0
  ) {
    throw new InvalidModuleDefinitionProblem(
      `Module '${module.name}' must define metadata or lifecycle hooks.`,
      { moduleName: module.name },
    );
  }
}

function createModuleGraphDiagnostics(
  modules: readonly ModuleOptions[],
  states: ReadonlyMap<string, ModuleRuntimeState>,
  rejectUnknownProvider = false,
): ModuleGraphDiagnostic[] {
  const diagnostics: ModuleGraphDiagnostic[] = [];

  for (const conflict of getProviderOwnershipConflicts(modules)) {
    const token = getModuleTokenLabel(conflict.token);
    diagnostics.push({
      code: "framework-module/provider-ownership-conflict",
      severity: "error",
      moduleName: conflict.owners[0] ?? "<unknown>",
      token,
      message: formatModuleProviderOwnershipDetail(token, conflict.owners),
      path: conflict.owners,
    });
  }

  try {
    detectCircularDependency(modules);
  } catch (error) {
    if (!(error instanceof ModuleCircularDependencyProblem)) {
      throw error;
    }

    const cycle = Array.isArray(error.extensions?.cycle)
      ? error.extensions.cycle.filter((entry): entry is string => typeof entry === "string")
      : [];

    diagnostics.push({
      code: "framework-module/circular-dependency",
      severity: "error",
      moduleName: cycle[0] ?? "<unknown>",
      message: error.detail ?? error.message,
      path: cycle,
    });
  }

  for (const module of modules) {
    for (const provider of module.providers ?? []) {
      const classProvider = getClassProviderEntry(provider);
      if (!classProvider) {
        continue;
      }

      const [, providerClass] = classProvider;
      for (const failure of getClassProviderVisibilityFailures(
        module.name,
        providerClass,
        states,
        rejectUnknownProvider,
      )) {
        const provider = getModuleTokenLabel(failure.token);
        diagnostics.push({
          code: "framework-module/provider-not-visible",
          severity: "error",
          moduleName: module.name,
          token: provider,
          message: `Module '${module.name}' cannot access provider '${provider}'. Export it from an imported module or register it locally.`,
          path: [module.name, getModuleTokenLabel(failure.providerClass), provider],
        });
      }
    }
  }

  return diagnostics.sort((left, right) => {
    const codeOrder = left.code.localeCompare(right.code);
    if (codeOrder !== 0) {
      return codeOrder;
    }

    const moduleOrder = left.moduleName.localeCompare(right.moduleName);
    return moduleOrder === 0 ? (left.token ?? "").localeCompare(right.token ?? "") : moduleOrder;
  });
}

function createModuleGraphModule(module: ModuleOptions): ModuleGraphModule {
  return {
    name: module.name,
    imports: (module.imports?.map((importedModule) => importedModule.name) ?? []).sort(),
    providers: (module.providers?.map(createModuleGraphProvider) ?? []).sort((left, right) =>
      left.token.localeCompare(right.token),
    ),
    exports: (module.exports?.map(getModuleTokenLabel) ?? []).sort(),
    controllers: (module.controllers?.map(getModuleTokenLabel) ?? []).sort(),
  };
}

function createModuleGraphProvider(
  provider: ModuleProviderDefinition | ModuleToken<unknown>,
): ModuleGraphProvider {
  if (!isProviderDefinition(provider)) {
    return {
      token: getModuleTokenLabel(provider),
      provider: isConstructorToken(provider) ? "class" : "token",
      ...(isConstructorToken(provider) ? { className: getModuleTokenLabel(provider) } : {}),
    };
  }

  if ("useClass" in provider) {
    return {
      token: getModuleTokenLabel(provider.provide),
      provider: "class",
      className: getModuleTokenLabel(provider.useClass),
    };
  }

  return {
    token: getModuleTokenLabel(provider.provide),
    provider: "useFactory" in provider ? "factory" : "value",
  };
}

function collectModules(
  rootModules: readonly ModuleOptions[],
  moduleSources: WeakMap<ModuleOptions, ModuleOptions>,
): ModuleOptions[] {
  const modules = new Map<
    string,
    {
      readonly source: ModuleOptions;
      readonly snapshot: ModuleOptions & { imports: ModuleOptions[] };
      readonly path: readonly string[];
    }
  >();

  const visit = (module: ModuleOptions, path: readonly string[]): ModuleOptions => {
    const name = module.name;
    const source = getModuleSource(module, moduleSources);
    const existing = modules.get(name);
    if (existing) {
      if (existing.source !== source) {
        throw new ModuleDuplicateNameProblem(name, existing.path, path);
      }

      return existing.snapshot;
    }

    const sourceImports = module.imports;
    const sourceProviders = module.providers;
    const sourceExports = module.exports;
    const sourceControllers = module.controllers;
    const setup = module.setup;
    const start = module.start;
    const shutdown = module.shutdown;
    const snapshot: ModuleOptions & { imports: ModuleOptions[] } = {
      name,
      imports: [],
      ...(sourceProviders ? { providers: Array.from(sourceProviders, snapshotProvider) } : {}),
      ...(sourceExports ? { exports: Array.from(sourceExports) } : {}),
      ...(sourceControllers ? { controllers: Array.from(sourceControllers) } : {}),
      ...(setup ? { setup } : {}),
      ...(start ? { start } : {}),
      ...(shutdown ? { shutdown } : {}),
    };

    modules.set(name, { source, snapshot, path });
    moduleSources.set(snapshot, source);
    snapshot.imports.push(
      ...Array.from(sourceImports ?? [], (importedModule) =>
        visit(importedModule, [...path, importedModule.name]),
      ),
    );
    validateModule(snapshot);

    return snapshot;
  };

  for (const module of rootModules) {
    visit(module, [module.name]);
  }

  return Array.from(modules.values(), ({ snapshot }) => snapshot);
}

function getModuleSource(
  module: ModuleOptions,
  moduleSources: WeakMap<ModuleOptions, ModuleOptions>,
): ModuleOptions {
  return moduleSources.get(module) ?? module;
}

function snapshotProvider(provider: ModuleProvider): ModuleProvider {
  if (!isProviderDefinition(provider)) {
    return provider;
  }

  const token = provider.provide;
  if ("useValue" in provider) {
    return { provide: token, useValue: provider.useValue };
  }

  if ("useClass" in provider) {
    return { provide: token, useClass: provider.useClass };
  }

  return { provide: token, useFactory: provider.useFactory };
}

function assertUnambiguousProviderOwnership(modules: readonly ModuleOptions[]): void {
  const conflict = getProviderOwnershipConflicts(modules)[0];
  if (conflict) {
    throw new ModuleProviderOwnershipProblem(conflict.token, conflict.owners);
  }
}

function getProviderOwnershipConflicts(
  modules: readonly ModuleOptions[],
): ModuleProviderOwnershipConflict[] {
  const ownership = new Map<
    ServiceIdentifier<unknown>,
    { readonly token: ModuleToken<unknown>; readonly owners: Set<string> }
  >();

  for (const module of modules) {
    for (const provider of module.providers ?? []) {
      const token = getProviderToken(provider);
      const identifier = FrameworkContainer.toTypeDIServiceIdentifier(token);
      const entry = ownership.get(identifier) ?? { token, owners: new Set<string>() };
      entry.owners.add(module.name);
      ownership.set(identifier, entry);
    }
  }

  return Array.from(ownership.values())
    .flatMap(({ token, owners }) => {
      const sortedOwners = Array.from(owners).sort();
      return sortedOwners.length > 1 ? [{ token, owners: sortedOwners }] : [];
    })
    .sort((left, right) => {
      const tokenOrder = getModuleTokenLabel(left.token).localeCompare(
        getModuleTokenLabel(right.token),
      );
      if (tokenOrder !== 0) {
        return tokenOrder;
      }

      const ownerOrder = (left.owners[0] ?? "").localeCompare(right.owners[0] ?? "");
      return ownerOrder === 0
        ? left.owners.join("\u0000").localeCompare(right.owners.join("\u0000"))
        : ownerOrder;
    });
}

function sortModules(modules: readonly ModuleOptions[]): ModuleOptions[] {
  const sorted: ModuleOptions[] = [];
  const visited = new Set<string>();
  const moduleMap = new Map(modules.map((module) => [module.name, module]));

  const visit = (module: ModuleOptions): void => {
    if (visited.has(module.name)) {
      return;
    }

    visited.add(module.name);

    for (const importedModule of module.imports ?? []) {
      visit(moduleMap.get(importedModule.name) ?? importedModule);
    }

    sorted.push(module);
  };

  for (const module of modules) {
    visit(module);
  }

  return sorted;
}

function createModuleState(module: ModuleOptions): ModuleRuntimeState {
  return {
    module,
    phase: "registered",
    initialized: false,
    providers: new Set(module.providers?.map((provider) => getProviderToken(provider)) ?? []),
    exports: new Set(module.exports ?? []),
    controllers: new Set(module.controllers ?? []),
    classProviders: new Map(
      module.providers?.map(getClassProviderEntry).filter((entry) => entry !== null) ?? [],
    ),
  };
}

function createRootContext(
  state: ModuleRegistryState,
  container: ReturnType<typeof Container.of>,
): ModuleContext {
  const contextGeneration = state.registryGeneration;

  return new ModuleContext(container, {
    validateRuntime: () => assertRuntimeContextAvailable(state, contextGeneration),
    rejectUnknownProvider: state.rejectGlobalProviderFallback,
    ...(state.rejectGlobalProviderFallback
      ? {
          resolveProvider: <T>(token: ModuleToken<T>) =>
            resolveRuntimeProvider(container, "<root>", token),
        }
      : {}),
    isKnownToken: (token) => isKnownTokenInStates(token, state.moduleStates),
    validateProviderWrite: (moduleName, token) => {
      validateProviderWrite(state, moduleName, token);
    },
  });
}

function createModuleContext(
  state: ModuleRegistryState,
  moduleName: string,
  container: ReturnType<typeof Container.of>,
): ModuleContext {
  const contextGeneration = state.registryGeneration;

  return new ModuleContext(container, {
    moduleName,
    validateRuntime: () => assertRuntimeContextAvailable(state, contextGeneration),
    rejectUnknownProvider: state.rejectGlobalProviderFallback,
    ...(state.rejectGlobalProviderFallback
      ? {
          resolveProvider: <T>(token: ModuleToken<T>) =>
            resolveRuntimeProvider(container, moduleName, token),
        }
      : {}),
    canAccessToken: (ownerModuleName, token) =>
      canAccessTokenInStates(ownerModuleName, token, state.moduleStates),
    isKnownToken: (token) => isKnownTokenInStates(token, state.moduleStates),
    validateProviderWrite: (ownerModuleName, token) => {
      validateProviderWrite(state, ownerModuleName, token);
    },
    validateClassProvider: (ownerModuleName, providerClass) => {
      validateClassProviderVisibility(state, ownerModuleName, providerClass);
    },
    validateProviderAccess: (ownerModuleName, token) => {
      validateProviderAccess(state, ownerModuleName, token, container);
    },
  });
}

async function registerProviders(
  state: ModuleRegistryState,
  module: ModuleOptions,
  context: ModuleContext,
  container: ReturnType<typeof Container.of>,
): Promise<void> {
  for (const provider of module.providers ?? []) {
    if (!isProviderDefinition(provider)) {
      if (isConstructorToken(provider)) {
        validateClassProviderVisibility(state, module.name, provider);
        validateProviderWrite(state, module.name, provider);
        container.set({
          id: FrameworkContainer.toTypeDIServiceIdentifier(provider),
          type: toTypediConstructable(provider),
        });
      }
      continue;
    }

    await registerProviderDefinition(state, module.name, provider, context, container);
  }
}

async function registerProviderDefinition<T>(
  state: ModuleRegistryState,
  moduleName: string,
  provider: ModuleProviderDefinition<T>,
  context: ModuleContext,
  container: ReturnType<typeof Container.of>,
): Promise<void> {
  const token = provider.provide;

  if ("useValue" in provider) {
    context.set(token, provider.useValue);
    return;
  }

  if ("useClass" in provider) {
    validateClassProviderVisibility(state, moduleName, provider.useClass);
    validateProviderWrite(state, moduleName, token);
    container.set({
      id: FrameworkContainer.toTypeDIServiceIdentifier(token),
      type: toTypediConstructable(provider.useClass),
    });
    return;
  }

  context.set(token, await provider.useFactory(context));
}

function validateProviderWrite(
  state: ModuleRegistryState,
  moduleName: string | undefined,
  token: ModuleToken<unknown>,
): void {
  if (!moduleName) {
    throw new ModuleProviderWriteProblem("<root>", token);
  }

  const normalizedToken = normalizeTokenInStates(token, state.moduleStates);
  if (hasEquivalentToken(state.moduleStates.get(moduleName)?.providers, normalizedToken)) {
    return;
  }

  throw new ModuleProviderWriteProblem(
    moduleName,
    normalizedToken,
    getDeclaredProviderOwner(state, normalizedToken),
  );
}

function getDeclaredProviderOwner(
  state: ModuleRegistryState,
  token: ModuleToken<unknown>,
): string | undefined {
  return Array.from(state.moduleStates.entries()).find(([, moduleState]) =>
    hasEquivalentToken(moduleState.providers, token),
  )?.[0];
}

function isKnownTokenInStates(
  token: ModuleToken<unknown>,
  states: ReadonlyMap<string, ModuleRuntimeState>,
): boolean {
  const normalizedToken = normalizeTokenInStates(token, states);
  return Array.from(states.values()).some(
    (state) =>
      hasEquivalentToken(state.providers, normalizedToken) ||
      hasEquivalentToken(state.exports, normalizedToken),
  );
}

function canAccessTokenInStates(
  moduleName: string,
  token: ModuleToken<unknown>,
  states: ReadonlyMap<string, ModuleRuntimeState>,
): boolean {
  const state = states.get(moduleName);
  if (!state) {
    return false;
  }

  const normalizedToken = normalizeTokenInStates(token, states);
  if (hasEquivalentToken(state.providers, normalizedToken)) {
    return true;
  }

  return (state.module.imports ?? []).some((module) =>
    hasEquivalentToken(states.get(module.name)?.exports, normalizedToken),
  );
}

function validateProviderAccess(
  state: ModuleRegistryState,
  moduleName: string,
  token: ModuleToken<unknown>,
  container: ContainerInstance,
): void {
  const provider = getAccessibleClassProvider(moduleName, token, state.moduleStates);
  if (!provider) {
    if (hasUndeclaredTypediClassProvider(container, token)) {
      throw new ModuleProviderVisibilityProblem(moduleName, token);
    }

    return;
  }

  validateClassProviderVisibility(state, provider.moduleName, provider.providerClass);
}

function getAccessibleClassProvider(
  moduleName: string,
  token: ModuleToken<unknown>,
  states: ReadonlyMap<string, ModuleRuntimeState>,
): {
  readonly moduleName: string;
  readonly providerClass: Constructor<unknown>;
} | null {
  const state = states.get(moduleName);
  if (!state) {
    return null;
  }

  const normalizedToken = normalizeTokenInStates(token, states);
  const localProviderClass = getEquivalentTokenValue(state.classProviders, normalizedToken);
  if (localProviderClass) {
    return { moduleName, providerClass: localProviderClass };
  }

  for (const importedModule of state.module.imports ?? []) {
    const importedState = states.get(importedModule.name);
    if (!hasEquivalentToken(importedState?.exports, normalizedToken)) {
      continue;
    }

    const providerClass = importedState
      ? getEquivalentTokenValue(importedState.classProviders, normalizedToken)
      : undefined;
    if (providerClass) {
      return { moduleName: importedModule.name, providerClass };
    }
  }

  return null;
}

function validateClassProviderVisibility<T>(
  state: ModuleRegistryState,
  moduleName: string,
  providerClass: Constructor<T>,
): void {
  const failure = getClassProviderVisibilityFailures(
    moduleName,
    providerClass,
    state.moduleStates,
    state.rejectGlobalProviderFallback,
  )[0];

  if (failure) {
    throw new ModuleProviderVisibilityProblem(moduleName, failure.token);
  }
}

function getClassProviderVisibilityFailures<T>(
  moduleName: string,
  providerClass: Constructor<T>,
  states: ReadonlyMap<string, ModuleRuntimeState>,
  rejectUnknownProvider = false,
): ModuleProviderVisibilityFailure[] {
  const failures: ModuleProviderVisibilityFailure[] = [];
  const dependencies = getConstructorDependencies(providerClass);

  for (const dependency of dependencies) {
    if (!isConstructorToken(dependency) || IGNORED_CONSTRUCTOR_DEPENDENCIES.has(dependency)) {
      continue;
    }

    const dependencyToken = dependency as ModuleToken<unknown>;
    const known = isKnownTokenInStates(dependencyToken, states);
    if (
      (known && !canAccessTokenInStates(moduleName, dependencyToken, states)) ||
      (!known && rejectUnknownProvider)
    ) {
      failures.push({ moduleName, providerClass, token: dependencyToken });
    }
  }

  for (const dependency of getTypediHandlerDependencies(providerClass)) {
    const dependencyToken = normalizeTokenInStates(dependency, states);
    const known = isKnownTokenInStates(dependencyToken, states);
    if (
      (known && !canAccessTokenInStates(moduleName, dependencyToken, states)) ||
      (!known && rejectUnknownProvider)
    ) {
      failures.push({ moduleName, providerClass, token: dependencyToken });
    }
  }

  return failures;
}

function normalizeTokenInStates(
  token: ModuleToken<unknown>,
  states: ReadonlyMap<string, ModuleRuntimeState>,
): ModuleToken<unknown> {
  for (const state of states.values()) {
    for (const candidate of state.providers) {
      if (
        typeof candidate === "symbol" &&
        FrameworkContainer.toTypeDIServiceIdentifier(candidate) === token
      ) {
        return candidate;
      }
    }

    for (const candidate of state.exports) {
      if (
        typeof candidate === "symbol" &&
        FrameworkContainer.toTypeDIServiceIdentifier(candidate) === token
      ) {
        return candidate;
      }
    }
  }

  return token;
}

function hasEquivalentToken(
  tokens: ReadonlySet<ModuleToken<unknown>> | undefined,
  token: ModuleToken<unknown>,
): boolean {
  return tokens
    ? Array.from(tokens).some((candidate) => areEquivalentTokens(candidate, token))
    : false;
}

function getEquivalentTokenValue<T>(
  values: ReadonlyMap<ModuleToken<unknown>, T>,
  token: ModuleToken<unknown>,
): T | undefined {
  for (const [candidate, value] of values) {
    if (areEquivalentTokens(candidate, token)) {
      return value;
    }
  }

  return undefined;
}

function areEquivalentTokens(left: ModuleToken<unknown>, right: ModuleToken<unknown>): boolean {
  return (
    left === right ||
    (typeof left === "symbol" && FrameworkContainer.toTypeDIServiceIdentifier(left) === right) ||
    (typeof right === "symbol" && FrameworkContainer.toTypeDIServiceIdentifier(right) === left)
  );
}

function getConstructorDependencies<T>(providerClass: Constructor<T>): readonly unknown[] {
  return (
    (Reflect.getMetadata("design:paramtypes", providerClass) as readonly unknown[] | undefined) ??
    []
  );
}

function toTypediConstructable<T>(providerClass: Constructor<T>): Constructable<T> {
  return providerClass as unknown as Constructable<T>;
}

function hasUndeclaredTypediClassProvider(
  container: ContainerInstance,
  token: ModuleToken<unknown>,
): boolean {
  const service = getTypediServiceMetadata(container, token);

  return Boolean(service?.type || service?.factory);
}

function getTypediServiceMetadata(
  container: ContainerInstance,
  token: ModuleToken<unknown>,
): ServiceMetadata<unknown> | undefined {
  const services = getContainerServices(container);

  const identifier = FrameworkContainer.toTypeDIServiceIdentifier(token);
  return services.find((service) => service.id === identifier);
}

function resolveRuntimeProvider<T>(
  container: ContainerInstance,
  moduleName: string,
  token: ModuleToken<T>,
): T {
  try {
    return container.get(FrameworkContainer.toTypeDIServiceIdentifier(token));
  } catch (error) {
    if (error instanceof ServiceNotFoundError) {
      throw new ModuleProviderUnavailableProblem(moduleName, token, error);
    }

    throw error;
  }
}

function getClassProviderEntry(
  provider: ModuleProviderDefinition | ModuleToken<unknown>,
): readonly [ModuleToken<unknown>, Constructor<unknown>] | null {
  if (!isProviderDefinition(provider)) {
    if (!isConstructorToken(provider)) {
      return null;
    }

    return [provider, provider];
  }

  if ("useClass" in provider) {
    return [provider.provide, provider.useClass];
  }

  return null;
}

function getTypediHandlerDependencies<T>(providerClass: Constructor<T>): ModuleToken<unknown>[] {
  const providerTarget = toTypediConstructable(providerClass);

  return Container.handlers
    .filter((handler) => isTypediHandlerForProvider(handler, providerTarget))
    .map(captureTypediHandlerDependency)
    .filter((dependency) => dependency !== null);
}

function isTypediHandlerForProvider<T>(
  handler: Handler,
  providerTarget: Constructable<T>,
): boolean {
  if (typeof handler.index === "number") {
    return (
      handler.object === providerTarget || handler.object === Object.getPrototypeOf(providerTarget)
    );
  }

  return (
    handler.object.constructor === providerTarget ||
    providerTarget.prototype instanceof handler.object.constructor
  );
}

function captureTypediHandlerDependency(handler: Handler): ModuleToken<unknown> | null {
  try {
    handler.value(createTypediDependencyProbe());
  } catch (error) {
    if (error instanceof CapturedTypediInjectionToken) {
      return error.token;
    }

    throw error;
  }

  return null;
}

function createTypediDependencyProbe(): ContainerInstance {
  const probe = {
    get: <T>(identifier: ServiceIdentifier<T>): T => {
      throw new CapturedTypediInjectionToken(identifier as unknown as ModuleToken<unknown>);
    },
    getMany: <T>(identifier: ServiceIdentifier<T>): T[] => {
      throw new CapturedTypediInjectionToken(identifier as unknown as ModuleToken<unknown>);
    },
  };

  return probe as unknown as ContainerInstance;
}

async function runLifecycle(
  registryState: ModuleRegistryState,
  module: ModuleOptions,
  phase: ModuleLifecyclePhase,
  run: () => Promise<void>,
): Promise<void> {
  const moduleState = registryState.moduleStates.get(module.name);
  if (moduleState) {
    moduleState.phase = phase;
  }

  try {
    await run();
  } catch (error) {
    const problem = new ModuleLifecycleProblem(module.name, phase, error);
    if (moduleState) {
      moduleState.phase = "failed";
      moduleState.initialized = false;
      moduleState.lastError = problem.message;
    }
    throw problem;
  }
}
