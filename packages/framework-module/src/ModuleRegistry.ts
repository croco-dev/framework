import { Container, ServiceNotFoundError } from "typedi";
import type { Constructable, ContainerInstance, ServiceIdentifier, ServiceMetadata } from "typedi";
import "reflect-metadata";
import { Container as FrameworkContainer } from "@croco/framework-context";
import { detectCircularDependency } from "./CircularDependencyDetector";
import { ModuleContext } from "./ModuleContext";
import { getModuleTokenLabel } from "./moduleTokenLabels";
import { getProviderToken, isConstructorToken, isProviderDefinition } from "./moduleTokens";
import type { ApplicationProviderReplacement } from "./Plugin";
import {
  attachModuleCleanupFailures,
  attachModuleLifecycleHookFailure,
  InvalidModuleDefinitionProblem,
  formatModuleProviderOwnershipDetail,
  ModuleCircularDependencyProblem,
  ModuleContributionIdentityProblem,
  ModuleDuplicateNameProblem,
  ModuleLifecycleCancelledProblem,
  ModuleLifecycleDeadlineExceededProblem,
  ModuleLifecycleProblem,
  ModuleProviderOwnershipProblem,
  ModuleProviderUnavailableProblem,
  ModuleProviderVisibilityProblem,
  ModuleProviderWriteProblem,
  ModuleRegistrationConflictProblem,
  ModuleRuntimeDisposedProblem,
  ModuleRuntimeResetConflictProblem,
  ModuleRuntimeStaleContextProblem,
  validateModuleLifecycleExecutionOptions,
} from "./problems";
import type {
  ModuleLifecycleExecutionProblem,
  ModuleLifecycleInterruptionProblem,
} from "./problems";
import type {
  ModuleCleanupFailure,
  ModuleGraphDiagnostic,
  ModuleGraphManifest,
  ModuleGraphModule,
  ModuleGraphProvider,
  ModuleDiagnosticsSnapshot,
  ModuleLifecycleExecutionContext,
  ModuleLifecycleExecutionOptions,
  ModuleLifecycleFailure,
  ModuleLifecyclePhase,
  ModuleOptions,
  ModuleProvider,
  ModuleProviderDefinition,
  ResolvedModuleContribution,
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
  readonly providerReplacements: readonly ApplicationProviderReplacement[];
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

const IGNORED_CONSTRUCTOR_DEPENDENCIES = new Set<unknown>([
  Array,
  Boolean,
  Number,
  Object,
  Promise,
  String,
]);
const MAX_TIMER_DELAY_MS = 2_147_483_647;
const APPLICATION_MODULE_NAME = "<application>";
const APPLICATION_REPLACEMENT_PHASE = Symbol("application-replacement-phase");
let moduleRuntimeSequence = 0;
export interface ModuleRuntime extends AsyncDisposable {
  use(module: ModuleOptions): void;
  initialize(options?: ModuleLifecycleExecutionOptions): Promise<ModuleContext>;
  shutdown(options?: ModuleLifecycleExecutionOptions): Promise<void>;
  reset(): void;
  dispose(): Promise<void>;
  createGraphManifest(): ModuleGraphManifest;
  getRegisteredModules(): readonly ModuleDiagnosticsSnapshot[];
  getContributions<T, TKind extends string = string>(
    kind: TKind,
  ): readonly ResolvedModuleContribution<T, TKind>[];
}

class ModuleRuntimeImplementation implements ModuleRuntime {
  constructor(private readonly state: ModuleRegistryState) {}

  use(module: ModuleOptions): void {
    assertRuntimeAvailable(this.state);
    registerModuleInState(this.state, module);
  }

  initialize(options: ModuleLifecycleExecutionOptions = {}): Promise<ModuleContext> {
    try {
      assertRuntimeAvailable(this.state);
      return initializeModulesInState(this.state, options);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  shutdown(options: ModuleLifecycleExecutionOptions = {}): Promise<void> {
    try {
      assertRuntimeAvailable(this.state);
      return shutdownModulesInState(this.state, options);
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

  getContributions<T, TKind extends string = string>(
    kind: TKind,
  ): readonly ResolvedModuleContribution<T, TKind>[] {
    assertRuntimeAvailable(this.state);
    return getResolvedContributions<T, TKind>(this.state, kind);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }
}

function createModuleRegistryState(
  containerId?: string,
  providerReplacements: readonly ApplicationProviderReplacement[] = [],
): ModuleRegistryState {
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
    providerReplacements,
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

export function createModuleRuntimeForContainer(
  containerId: string,
  providerReplacements: readonly ApplicationProviderReplacement[] = [],
): ModuleRuntime {
  return new ModuleRuntimeImplementation(
    createModuleRegistryState(containerId, providerReplacements),
  );
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
  let primaryFailure: unknown;
  try {
    await shutdownModulesInState(state);
  } catch (error) {
    primaryFailure = error;
  }

  try {
    resetModulesInState(state);
    if (state.containerId) {
      Container.reset(state.containerId);
    }
  } catch (error) {
    if (primaryFailure !== undefined) {
      const lifecycleFailure =
        primaryFailure instanceof ModuleLifecycleProblem
          ? primaryFailure
          : new ModuleLifecycleProblem("<registry>", "shutdown", primaryFailure);
      const existingFailures = Array.isArray(lifecycleFailure.extensions?.cleanupFailures)
        ? (lifecycleFailure.extensions.cleanupFailures as unknown as ModuleCleanupFailure[])
        : [];
      throw attachModuleCleanupFailures(lifecycleFailure, [
        ...existingFailures,
        createModuleCleanupFailure(
          new ModuleLifecycleProblem("<registry>", "shutdown", error),
          "<registry>",
        ),
      ]);
    }
    throw error;
  } finally {
    state.disposed = true;
  }

  if (primaryFailure !== undefined) {
    throw primaryFailure;
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

export function initializeModules(
  options: ModuleLifecycleExecutionOptions = {},
): Promise<ModuleContext> {
  return defaultModuleRuntime.initialize(options);
}

function initializeModulesInState(
  state: ModuleRegistryState,
  options: ModuleLifecycleExecutionOptions,
): Promise<ModuleContext> {
  if (state.isInitialized && state.activeContext) {
    return Promise.resolve(state.activeContext);
  }

  if (state.initializationPromise) {
    return state.initializationPromise;
  }

  validateModuleLifecycleExecutionOptions("initialize", options);

  state.isInitializing = true;
  const attempt = performInitializeModules(state, options);
  state.initializationPromise = attempt;
  void attempt.then(
    () => clearInitializationPromise(state, attempt),
    () => clearInitializationPromise(state, attempt),
  );
  return attempt;
}

async function performInitializeModules(
  state: ModuleRegistryState,
  options: ModuleLifecycleExecutionOptions,
): Promise<ModuleContext> {
  const attemptGeneration = state.registryGeneration;
  const modules = collectModules(Array.from(state.registeredModules.values()), state.moduleSources);
  detectCircularDependency(modules);
  assertValidProviderReplacements(modules, state.providerReplacements);
  assertUnambiguousProviderOwnership(modules, state.providerReplacements);
  assertUniqueContributionIdentities(modules);

  const initializationUnits = sortModuleInitializationUnits(modules, state.providerReplacements);
  const sortedModules = initializationUnits.filter(
    (unit): unit is ModuleOptions => unit !== APPLICATION_REPLACEMENT_PHASE,
  );
  const container = state.container;
  const context = createRootContext(state, container);
  const containerSnapshot = snapshotContainerServices(container, sortedModules);
  const compensationStack: ModuleOptions[] = [];

  state.moduleStates.clear();
  for (const module of sortedModules) {
    state.moduleStates.set(module.name, createModuleState(module));
  }

  try {
    for (const unit of initializationUnits) {
      if (unit === APPLICATION_REPLACEMENT_PHASE) {
        const applicationModule: ModuleOptions = { name: APPLICATION_MODULE_NAME };
        const applicationContext = createApplicationContext(state, container);
        await runLifecycle(
          state,
          applicationModule,
          "setup",
          options,
          applicationContext,
          true,
          async (execution) => {
            await registerApplicationProviderReplacements(
              state,
              applicationContext,
              container,
              execution.signal,
            );
          },
        );
        continue;
      }

      const module = unit;
      compensationStack.push(module);
      const moduleContext = createModuleContext(state, module.name, container);
      await runLifecycle(
        state,
        module,
        "setup",
        options,
        moduleContext,
        true,
        async (execution) => {
          await registerProviders(state, module, moduleContext, container, execution.signal);
          execution.signal.throwIfAborted();
          await module.setup?.(moduleContext, execution);
        },
      );
    }

    for (const module of sortedModules) {
      const moduleContext = createModuleContext(state, module.name, container);
      await runLifecycle(
        state,
        module,
        "start",
        options,
        moduleContext,
        module.start !== undefined,
        async (execution) => {
          await module.start?.(moduleContext, execution);
        },
      );

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
    assertModuleLifecycleOperationActive("<registry>", "start", options);
  } catch (error) {
    const cleanupFailures = await compensateInitialization(
      state,
      compensationStack,
      container,
      error,
      options,
    );
    cleanupFailures.push(
      ...restoreContainerServices(container, containerSnapshot).map((restoreError) =>
        createModuleCleanupFailure(
          new ModuleLifecycleProblem("<registry>", "shutdown", restoreError),
          "<registry>",
        ),
      ),
    );
    state.registryGeneration += 1;
    resetActiveRuntimeState(state);

    if (isModuleLifecycleExecutionProblem(error)) {
      throw attachModuleCleanupFailures(error, cleanupFailures);
    }
    if (cleanupFailures.length > 0) {
      throw attachModuleCleanupFailures(
        new ModuleLifecycleProblem("<registry>", "setup", error),
        cleanupFailures,
      );
    }
    throw error;
  }

  state.isInitialized = true;
  state.initializedModules = sortedModules;
  state.activeContext = context;
  return context;
}

export async function shutdownModules(
  options: ModuleLifecycleExecutionOptions = {},
): Promise<void> {
  await defaultModuleRuntime.shutdown(options);
}

async function shutdownModulesInState(
  state: ModuleRegistryState,
  options: ModuleLifecycleExecutionOptions = {},
): Promise<void> {
  if (state.shutdownPromise) {
    return state.shutdownPromise;
  }

  validateModuleLifecycleExecutionOptions("shutdown", options);

  state.activeShutdownOperations += 1;
  const attempt = performShutdownModules(state, options);
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

async function performShutdownModules(
  state: ModuleRegistryState,
  options: ModuleLifecycleExecutionOptions,
): Promise<void> {
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
  let firstFailure: ModuleLifecycleExecutionProblem | undefined;

  try {
    for (const module of modules) {
      try {
        const moduleContext = createModuleContext(state, module.name, container);
        await runLifecycle(
          state,
          module,
          "shutdown",
          options,
          moduleContext,
          module.shutdown !== undefined,
          async (execution) => {
            await module.shutdown?.(moduleContext, execution);
          },
          true,
        );

        const moduleState = state.moduleStates.get(module.name);
        if (moduleState) {
          moduleState.phase = "stopped";
          moduleState.initialized = false;
          moduleState.lastError = undefined;
          moduleState.cleanupFailures = undefined;
        }
      } catch (error) {
        const problem = isModuleLifecycleExecutionProblem(error)
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

    if (!firstFailure) {
      assertModuleLifecycleOperationActive("<registry>", "shutdown", options);
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
  options: ModuleLifecycleExecutionOptions,
): Promise<ModuleCleanupFailure[]> {
  const failures: ModuleCleanupFailure[] = [];
  const primaryModuleName =
    isModuleLifecycleExecutionProblem(primaryError) &&
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
      if (module.shutdown) {
        const moduleContext = createModuleContext(registryState, module.name, container);
        await executeModuleLifecycleHook(
          module,
          "shutdown",
          options,
          moduleContext,
          async (execution) => {
            await module.shutdown?.(moduleContext, execution);
          },
          true,
        );
      }
      if (moduleState) {
        moduleState.phase = "stopped";
      }
    } catch (error) {
      const problem = isModuleLifecycleExecutionProblem(error)
        ? error
        : new ModuleLifecycleProblem(module.name, "shutdown", error);
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
  problem: ModuleLifecycleExecutionProblem,
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
): readonly unknown[] {
  const services = getContainerServices(container);
  const originalRecords = new Map(
    snapshot.affectedRecords.map((record) => [record.reference, record]),
  );
  const currentAffectedRecords = services.filter((service) =>
    snapshot.affectedIdentifiers.has(service.id),
  );
  const cleanupFailures: unknown[] = [];

  for (const service of currentAffectedRecords) {
    const original = originalRecords.get(service);
    if (!original || service.value !== original.values.value) {
      try {
        destroyContainerService(container, service);
      } catch (error) {
        cleanupFailures.push(error);
      }
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
  return cleanupFailures;
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
  assertValidProviderReplacements(modules, state.providerReplacements);
  const states = new Map(modules.map((module) => [module.name, createModuleState(module)]));
  const diagnostics = createModuleGraphDiagnostics(
    modules,
    states,
    state.rejectGlobalProviderFallback,
    state.providerReplacements,
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
    (module.controllers?.length ?? 0) === 0 &&
    (module.contributions?.length ?? 0) === 0
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
  providerReplacements: readonly ApplicationProviderReplacement[] = [],
): ModuleGraphDiagnostic[] {
  const diagnostics: ModuleGraphDiagnostic[] = [];

  for (const conflict of getUnresolvedProviderOwnershipConflicts(modules, providerReplacements)) {
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

  for (const conflict of getContributionIdentityConflicts(modules)) {
    diagnostics.push({
      code: "framework-module/contribution-identity-conflict",
      severity: "error",
      moduleName: conflict.owners[0] ?? "<unknown>",
      token: `${conflict.kind}:${conflict.id}`,
      message: `Contribution '${conflict.kind}:${conflict.id}' is declared more than once by: ${conflict.owners.join(", ")}.`,
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
      for (const inspection of FrameworkContainer.inspectTypeDIInjections(providerClass)) {
        if (inspection.status !== "uninspectable") {
          continue;
        }

        const provider = getModuleTokenLabel(providerClass);
        diagnostics.push({
          code: "framework-module/provider-injection-uninspectable",
          severity: "error",
          moduleName: module.name,
          token: provider,
          message: `Module '${module.name}' provider '${provider}' has a TypeDI injection handler at ${inspection.site} that cannot be inspected without executing user code.`,
          path: [module.name, provider, inspection.site],
        });
      }

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
    contributions: (module.contributions ?? [])
      .map((contribution) => ({
        id: contribution.id,
        kind: contribution.kind,
        order: contribution.order ?? 0,
      }))
      .sort(compareContributionMetadata),
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
    const sourceContributions = module.contributions;
    const setup = module.setup;
    const start = module.start;
    const shutdown = module.shutdown;
    const snapshot: ModuleOptions & { imports: ModuleOptions[] } = {
      name,
      imports: [],
      ...(sourceProviders ? { providers: Array.from(sourceProviders, snapshotProvider) } : {}),
      ...(sourceExports ? { exports: Array.from(sourceExports) } : {}),
      ...(sourceControllers ? { controllers: Array.from(sourceControllers) } : {}),
      ...(sourceContributions
        ? {
            contributions: Array.from(sourceContributions, (contribution) => ({
              ...contribution,
            })),
          }
        : {}),
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

function assertUnambiguousProviderOwnership(
  modules: readonly ModuleOptions[],
  replacements: readonly ApplicationProviderReplacement[] = [],
): void {
  const conflict = getUnresolvedProviderOwnershipConflicts(modules, replacements)[0];
  if (conflict) {
    throw new ModuleProviderOwnershipProblem(conflict.token, conflict.owners);
  }
}

function getUnresolvedProviderOwnershipConflicts(
  modules: readonly ModuleOptions[],
  replacements: readonly ApplicationProviderReplacement[],
): ModuleProviderOwnershipConflict[] {
  const replacementIdentifiers = new Set(
    replacements.map((replacement) =>
      FrameworkContainer.toTypeDIServiceIdentifier(replacement.provider.provide),
    ),
  );
  return getProviderOwnershipConflicts(modules).filter(
    (conflict) =>
      !replacementIdentifiers.has(FrameworkContainer.toTypeDIServiceIdentifier(conflict.token)),
  );
}

function assertValidProviderReplacements(
  modules: readonly ModuleOptions[],
  replacements: readonly ApplicationProviderReplacement[],
): void {
  const seen = new Set<ServiceIdentifier<unknown>>();
  const ownership = getProviderOwnership(modules);

  for (const replacement of replacements) {
    const identifier = FrameworkContainer.toTypeDIServiceIdentifier(replacement.provider.provide);
    if (seen.has(identifier)) {
      throw new InvalidModuleDefinitionProblem(
        `Application defines multiple replacements for provider '${getModuleTokenLabel(replacement.provider.provide)}'.`,
      );
    }
    seen.add(identifier);

    const owners = ownership.get(identifier)?.owners ?? new Set<string>();
    const actualOwners = [...owners].sort();
    const declaredOwners = [...replacement.replaces].sort();
    if (
      declaredOwners.length === 0 ||
      new Set(declaredOwners).size !== declaredOwners.length ||
      actualOwners.length !== declaredOwners.length ||
      actualOwners.some((owner, index) => owner !== declaredOwners[index])
    ) {
      throw new InvalidModuleDefinitionProblem(
        `Application replacement for provider '${getModuleTokenLabel(replacement.provider.provide)}' must name its exact owners.`,
        {
          token: getModuleTokenLabel(replacement.provider.provide),
          actualOwners,
          declaredOwners,
        },
      );
    }
  }
}

function getProviderOwnership(
  modules: readonly ModuleOptions[],
): Map<
  ServiceIdentifier<unknown>,
  { readonly token: ModuleToken<unknown>; readonly owners: Set<string> }
> {
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

  return ownership;
}

function getProviderOwnershipConflicts(
  modules: readonly ModuleOptions[],
): ModuleProviderOwnershipConflict[] {
  return Array.from(getProviderOwnership(modules).values())
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

function sortModuleInitializationUnits(
  modules: readonly ModuleOptions[],
  replacements: readonly ApplicationProviderReplacement[],
): Array<ModuleOptions | typeof APPLICATION_REPLACEMENT_PHASE> {
  if (replacements.length === 0) {
    return sortModules(modules);
  }

  const units: Array<ModuleOptions | typeof APPLICATION_REPLACEMENT_PHASE> = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const moduleMap = new Map(modules.map((module) => [module.name, module]));
  const ownerNames = getApplicationReplacementOwnerNames(replacements);
  const dependencies = getApplicationReplacementDependencies(modules, replacements);
  let applicationVisited = false;
  let applicationVisiting = false;

  const visitApplication = (): void => {
    if (applicationVisited) {
      return;
    }
    if (applicationVisiting) {
      throw new InvalidModuleDefinitionProblem(
        "Application provider replacement dependencies must not depend on a replaced provider owner.",
        { owners: [...ownerNames].sort() },
      );
    }

    applicationVisiting = true;
    for (const dependency of dependencies) {
      visitModule(dependency);
    }
    applicationVisiting = false;
    applicationVisited = true;
    units.push(APPLICATION_REPLACEMENT_PHASE);
  };

  const visitModule = (module: ModuleOptions): void => {
    if (visited.has(module.name)) {
      return;
    }
    if (visiting.has(module.name)) {
      return;
    }

    visiting.add(module.name);
    for (const importedModule of module.imports ?? []) {
      visitModule(moduleMap.get(importedModule.name) ?? importedModule);
    }
    if (ownerNames.has(module.name)) {
      visitApplication();
    }
    visiting.delete(module.name);
    visited.add(module.name);
    units.push(module);
  };

  for (const module of modules) {
    visitModule(module);
  }

  if (!applicationVisited) {
    visitApplication();
  }
  return units;
}

function getApplicationReplacementOwnerNames(
  replacements: readonly ApplicationProviderReplacement[],
): ReadonlySet<string> {
  return new Set(replacements.flatMap((replacement) => replacement.replaces));
}

function getApplicationReplacementDependencies(
  modules: readonly ModuleOptions[],
  replacements: readonly ApplicationProviderReplacement[],
): readonly ModuleOptions[] {
  const moduleMap = new Map(modules.map((module) => [module.name, module]));
  const ownerNames = getApplicationReplacementOwnerNames(replacements);
  const dependencies = new Map<string, ModuleOptions>();
  const visitedOwners = new Set<string>();

  const collectOwnerDependencies = (owner: ModuleOptions): void => {
    if (visitedOwners.has(owner.name)) {
      return;
    }
    visitedOwners.add(owner.name);

    for (const importedModule of owner.imports ?? []) {
      const imported = moduleMap.get(importedModule.name) ?? importedModule;
      if (ownerNames.has(imported.name)) {
        collectOwnerDependencies(imported);
        continue;
      }
      dependencies.set(imported.name, imported);
    }
  };

  for (const ownerName of ownerNames) {
    const owner = moduleMap.get(ownerName);
    if (owner) {
      collectOwnerDependencies(owner);
    }
  }

  return [...dependencies.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function getApplicationReplacementDependenciesInState(
  state: ModuleRegistryState,
): readonly ModuleOptions[] {
  return getApplicationReplacementDependencies(
    [...state.moduleStates.values()].map((moduleState) => moduleState.module),
    state.providerReplacements,
  );
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

type ModuleContributionIdentityConflict = {
  readonly id: string;
  readonly kind: string;
  readonly owners: readonly string[];
};

function getContributionIdentityConflicts(
  modules: readonly ModuleOptions[],
): ModuleContributionIdentityConflict[] {
  const identities = new Map<
    string,
    { id: string; kind: string; owners: Set<string>; declarationCount: number }
  >();
  for (const module of modules) {
    for (const contribution of module.contributions ?? []) {
      validateContribution(module.name, contribution);
      const key = `${contribution.kind}\u0000${contribution.id}`;
      const entry = identities.get(key) ?? {
        id: contribution.id,
        kind: contribution.kind,
        owners: new Set<string>(),
        declarationCount: 0,
      };
      entry.owners.add(module.name);
      entry.declarationCount += 1;
      identities.set(key, entry);
    }
  }

  return [...identities.values()]
    .filter((entry) => entry.declarationCount > 1)
    .map((entry) => ({ ...entry, owners: [...entry.owners].sort() }))
    .sort((left, right) =>
      left.kind === right.kind
        ? left.id.localeCompare(right.id)
        : left.kind.localeCompare(right.kind),
    );
}

function assertUniqueContributionIdentities(modules: readonly ModuleOptions[]): void {
  const conflict = getContributionIdentityConflicts(modules)[0];
  if (conflict) {
    throw new ModuleContributionIdentityProblem(conflict.kind, conflict.id, conflict.owners);
  }
}

function validateContribution(
  moduleName: string,
  contribution: NonNullable<ModuleOptions["contributions"]>[number],
): void {
  if (contribution.kind.trim().length === 0 || contribution.id.trim().length === 0) {
    throw new InvalidModuleDefinitionProblem(
      `Module '${moduleName}' contribution kind and id must be non-empty strings.`,
      { moduleName },
    );
  }
  const order = contribution.order ?? 0;
  if (!Number.isSafeInteger(order)) {
    throw new InvalidModuleDefinitionProblem(
      `Module '${moduleName}' contribution '${contribution.kind}:${contribution.id}' order must be a safe integer.`,
      { moduleName, kind: contribution.kind, id: contribution.id, order },
    );
  }
}

function compareContributionMetadata(
  left: { readonly id: string; readonly kind: string; readonly order: number },
  right: { readonly id: string; readonly kind: string; readonly order: number },
): number {
  return (
    left.kind.localeCompare(right.kind) ||
    left.order - right.order ||
    left.id.localeCompare(right.id)
  );
}

function getResolvedContributions<T, TKind extends string>(
  state: ModuleRegistryState,
  kind: TKind,
): readonly ResolvedModuleContribution<T, TKind>[] {
  return [...state.moduleStates.values()]
    .flatMap((moduleState) =>
      (moduleState.module.contributions ?? [])
        .filter((contribution) => contribution.kind === kind)
        .map((contribution) => ({
          id: contribution.id,
          kind,
          moduleName: moduleState.module.name,
          order: contribution.order ?? 0,
          value: contribution.value as T,
        })),
    )
    .sort(
      (left, right) =>
        left.order - right.order ||
        left.id.localeCompare(right.id) ||
        left.moduleName.localeCompare(right.moduleName),
    );
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
    getContributions: (kind) => getResolvedContributions(state, kind),
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
    getContributions: (kind) => getResolvedContributions(state, kind),
  });
}

function createApplicationContext(
  state: ModuleRegistryState,
  container: ReturnType<typeof Container.of>,
): ModuleContext {
  const contextGeneration = state.registryGeneration;

  return new ModuleContext(container, {
    moduleName: APPLICATION_MODULE_NAME,
    validateRuntime: () => assertRuntimeContextAvailable(state, contextGeneration),
    rejectUnknownProvider: state.rejectGlobalProviderFallback,
    ...(state.rejectGlobalProviderFallback
      ? {
          resolveProvider: <T>(token: ModuleToken<T>) =>
            resolveRuntimeProvider(container, APPLICATION_MODULE_NAME, token),
        }
      : {}),
    canAccessToken: (_moduleName, token) => canApplicationAccessToken(state, token),
    isKnownToken: (token) => isKnownTokenInStates(token, state.moduleStates),
    validateProviderWrite: (moduleName, token) => {
      validateProviderWrite(state, moduleName, token);
    },
    validateClassProvider: (moduleName, providerClass) => {
      validateClassProviderVisibility(state, moduleName, providerClass);
    },
    validateProviderAccess: (moduleName, token) => {
      validateProviderAccess(state, moduleName, token, container);
    },
    getContributions: (kind) => getResolvedContributions(state, kind),
  });
}

async function registerProviders(
  state: ModuleRegistryState,
  module: ModuleOptions,
  context: ModuleContext,
  container: ReturnType<typeof Container.of>,
  signal: AbortSignal,
): Promise<void> {
  for (const provider of module.providers ?? []) {
    signal.throwIfAborted();
    const replacement = getProviderReplacement(state, provider);
    if (replacement) {
      continue;
    }
    if (!isProviderDefinition(provider)) {
      if (isConstructorToken(provider)) {
        validateClassProviderVisibility(state, module.name, provider);
        validateProviderWrite(state, module.name, provider);
        container.set({
          id: FrameworkContainer.toTypeDIServiceIdentifier(provider),
          type: toTypediConstructable(provider),
        });
      }
      signal.throwIfAborted();
      continue;
    }

    await registerProviderDefinition(state, module.name, provider, context, container);
    signal.throwIfAborted();
  }
}

async function registerApplicationProviderReplacements(
  state: ModuleRegistryState,
  context: ModuleContext,
  container: ReturnType<typeof Container.of>,
  signal: AbortSignal,
): Promise<void> {
  for (const replacement of state.providerReplacements) {
    signal.throwIfAborted();
    await registerProviderDefinition(
      state,
      APPLICATION_MODULE_NAME,
      replacement.provider,
      context,
      container,
    );
  }
}

function getProviderReplacement(
  state: ModuleRegistryState,
  provider: ModuleProvider,
): ApplicationProviderReplacement | undefined {
  const identifier = FrameworkContainer.toTypeDIServiceIdentifier(getProviderToken(provider));
  return state.providerReplacements.find(
    (replacement) =>
      FrameworkContainer.toTypeDIServiceIdentifier(replacement.provider.provide) === identifier,
  );
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
  const replacement = getProviderReplacement(state, normalizedToken);
  if (replacement) {
    if (moduleName === APPLICATION_MODULE_NAME) {
      return;
    }

    throw new ModuleProviderWriteProblem(moduleName, normalizedToken, APPLICATION_MODULE_NAME);
  }
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

function canApplicationAccessToken(
  state: ModuleRegistryState,
  token: ModuleToken<unknown>,
): boolean {
  if (
    state.providerReplacements.some((replacement) =>
      areEquivalentTokens(replacement.provider.provide, token),
    )
  ) {
    return true;
  }

  const normalizedToken = normalizeTokenInStates(token, state.moduleStates);
  const dependencies = getApplicationReplacementDependenciesInState(state);
  return dependencies.some((dependency) =>
    hasEquivalentToken(state.moduleStates.get(dependency.name)?.exports, normalizedToken),
  );
}

function validateProviderAccess(
  state: ModuleRegistryState,
  moduleName: string,
  token: ModuleToken<unknown>,
  container: ContainerInstance,
): void {
  const replacement = state.providerReplacements.find((candidate) =>
    areEquivalentTokens(candidate.provider.provide, token),
  );
  if (replacement) {
    if ("useClass" in replacement.provider) {
      validateClassProviderVisibility(
        state,
        APPLICATION_MODULE_NAME,
        replacement.provider.useClass,
      );
    }
    return;
  }

  const applicationDependencies =
    moduleName === APPLICATION_MODULE_NAME
      ? new Set(getApplicationReplacementDependenciesInState(state).map((module) => module.name))
      : undefined;
  const provider = getAccessibleClassProvider(
    moduleName,
    token,
    state.moduleStates,
    applicationDependencies,
  );
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
  applicationDependencies?: ReadonlySet<string>,
): {
  readonly moduleName: string;
  readonly providerClass: Constructor<unknown>;
} | null {
  if (moduleName === APPLICATION_MODULE_NAME) {
    const normalizedToken = normalizeTokenInStates(token, states);
    for (const [ownerModuleName, ownerState] of states) {
      if (!applicationDependencies?.has(ownerModuleName)) {
        continue;
      }
      if (!hasEquivalentToken(ownerState.exports, normalizedToken)) {
        continue;
      }

      const providerClass = getEquivalentTokenValue(ownerState.classProviders, normalizedToken);
      if (providerClass) {
        return { moduleName: ownerModuleName, providerClass };
      }
    }

    return null;
  }

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
    moduleName === APPLICATION_MODULE_NAME
      ? (token) => canApplicationAccessToken(state, token)
      : undefined,
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
  canAccessProvider: (token: ModuleToken<unknown>) => boolean = (token) =>
    canAccessTokenInStates(moduleName, token, states),
): ModuleProviderVisibilityFailure[] {
  const failures: ModuleProviderVisibilityFailure[] = [];
  const dependencies = getConstructorDependencies(providerClass);

  for (const dependency of dependencies) {
    if (!isConstructorToken(dependency) || IGNORED_CONSTRUCTOR_DEPENDENCIES.has(dependency)) {
      continue;
    }

    const dependencyToken = dependency as ModuleToken<unknown>;
    const known = isKnownTokenInStates(dependencyToken, states);
    if ((known && !canAccessProvider(dependencyToken)) || (!known && rejectUnknownProvider)) {
      failures.push({ moduleName, providerClass, token: dependencyToken });
    }
  }

  for (const dependency of getTypediHandlerDependencies(providerClass)) {
    const dependencyToken = normalizeTokenInStates(dependency, states);
    const known = isKnownTokenInStates(dependencyToken, states);
    if ((known && !canAccessProvider(dependencyToken)) || (!known && rejectUnknownProvider)) {
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
  return FrameworkContainer.inspectTypeDIInjections(providerClass).flatMap((inspection) =>
    inspection.status === "resolved" ? [inspection.token as ModuleToken<unknown>] : [],
  );
}

async function runLifecycle(
  registryState: ModuleRegistryState,
  module: ModuleOptions,
  phase: ModuleLifecyclePhase,
  options: ModuleLifecycleExecutionOptions,
  moduleContext: ModuleContext,
  hasCancellableWork: boolean,
  run: (execution: ModuleLifecycleExecutionContext) => Promise<void>,
  runWhenCancelled = false,
): Promise<void> {
  const moduleState = registryState.moduleStates.get(module.name);
  if (moduleState) {
    moduleState.phase = phase;
  }

  if (!hasCancellableWork) {
    return;
  }

  try {
    await executeModuleLifecycleHook(module, phase, options, moduleContext, run, runWhenCancelled);
  } catch (error) {
    const problem = isModuleLifecycleExecutionProblem(error)
      ? error
      : new ModuleLifecycleProblem(module.name, phase, error);
    if (moduleState) {
      moduleState.phase = "failed";
      moduleState.initialized = false;
      moduleState.lastError = problem.message;
    }
    throw problem;
  }
}

type ModuleLifecycleHookControl = {
  readonly execution: ModuleLifecycleExecutionContext;
  readonly getFailure: () => ModuleLifecycleInterruptionProblem | undefined;
  readonly dispose: () => void;
};

async function executeModuleLifecycleHook(
  module: ModuleOptions,
  phase: ModuleLifecyclePhase,
  options: ModuleLifecycleExecutionOptions,
  moduleContext: ModuleContext,
  run: (execution: ModuleLifecycleExecutionContext) => Promise<void>,
  runWhenCancelled: boolean,
): Promise<void> {
  const control = createModuleLifecycleHookControl(module, phase, options, moduleContext);

  try {
    if (!runWhenCancelled) {
      throwIfModuleLifecycleCancelled(control);
    }
    await run(control.execution);
    throwIfModuleLifecycleCancelled(control);
  } catch (error) {
    const failure = control.getFailure();
    if (failure) {
      throw error === failure
        ? failure
        : attachModuleLifecycleHookFailure(
            failure,
            createModuleLifecycleFailure(module.name, phase, error),
          );
    }
    throw new ModuleLifecycleProblem(module.name, phase, error);
  } finally {
    control.dispose();
  }
}

function createModuleLifecycleHookControl(
  module: ModuleOptions,
  phase: ModuleLifecyclePhase,
  options: ModuleLifecycleExecutionOptions,
  moduleContext: ModuleContext,
): ModuleLifecycleHookControl {
  const controller = new AbortController();
  let failure: ModuleLifecycleInterruptionProblem | undefined;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;

  const abort = (problem: ModuleLifecycleInterruptionProblem): void => {
    if (failure) {
      return;
    }
    failure = problem;
    controller.abort(problem);
  };
  const abortFromParent = (): void => {
    const reason = options.signal?.reason;
    abort(
      new ModuleLifecycleCancelledProblem(
        module.name,
        phase,
        reason instanceof Error ? reason : undefined,
      ),
    );
  };
  const abortFromDeadline = (): void => {
    if (options.deadline !== undefined) {
      abort(new ModuleLifecycleDeadlineExceededProblem(module.name, phase, options.deadline));
    }
  };
  const scheduleDeadline = (): void => {
    if (options.deadline === undefined || failure) {
      return;
    }
    const remainingMs = options.deadline - Date.now();
    if (remainingMs <= 0) {
      abortFromDeadline();
      return;
    }
    deadlineTimer = setTimeout(scheduleDeadline, Math.min(remainingMs, MAX_TIMER_DELAY_MS));
  };

  if (options.signal?.aborted) {
    abortFromParent();
  } else {
    options.signal?.addEventListener("abort", abortFromParent, { once: true });
    scheduleDeadline();
  }

  return {
    execution: {
      phase,
      moduleContext,
      signal: controller.signal,
      ...(options.deadline === undefined ? {} : { deadline: options.deadline }),
    },
    getFailure: () => {
      if (!failure && options.deadline !== undefined && Date.now() >= options.deadline) {
        abortFromDeadline();
      }
      return failure;
    },
    dispose: () => {
      options.signal?.removeEventListener("abort", abortFromParent);
      if (deadlineTimer !== undefined) {
        clearTimeout(deadlineTimer);
      }
    },
  };
}

function createModuleLifecycleFailure(
  moduleName: string,
  phase: ModuleLifecyclePhase,
  error: unknown,
): ModuleLifecycleFailure {
  const problem = new ModuleLifecycleProblem(moduleName, phase, error);
  return { moduleName, phase, code: problem.code, message: problem.message };
}

function throwIfModuleLifecycleCancelled(control: ModuleLifecycleHookControl): void {
  const failure = control.getFailure();
  if (failure) {
    throw failure;
  }
}

function assertModuleLifecycleOperationActive(
  moduleName: string,
  phase: ModuleLifecyclePhase,
  options: ModuleLifecycleExecutionOptions,
): void {
  if (options.signal?.aborted) {
    const reason = options.signal.reason;
    throw new ModuleLifecycleCancelledProblem(
      moduleName,
      phase,
      reason instanceof Error ? reason : undefined,
    );
  }
  if (options.deadline !== undefined && options.deadline <= Date.now()) {
    throw new ModuleLifecycleDeadlineExceededProblem(moduleName, phase, options.deadline);
  }
}

function isModuleLifecycleExecutionProblem(
  error: unknown,
): error is ModuleLifecycleExecutionProblem {
  return (
    error instanceof ModuleLifecycleProblem ||
    error instanceof ModuleLifecycleCancelledProblem ||
    error instanceof ModuleLifecycleDeadlineExceededProblem
  );
}
