import { Container } from "typedi";
import type {
  Constructable,
  ContainerInstance,
  Handler,
  ServiceIdentifier,
  ServiceMetadata,
} from "typedi";
import "reflect-metadata";
import { detectCircularDependency } from "./CircularDependencyDetector";
import { ModuleContext } from "./ModuleContext";
import { getModuleTokenLabel } from "./moduleTokenLabels";
import { getProviderToken, isConstructorToken, isProviderDefinition } from "./moduleTokens";
import {
  InvalidModuleDefinitionProblem,
  ModuleCircularDependencyProblem,
  ModuleLifecycleProblem,
  ModuleProviderVisibilityProblem,
} from "./problems";
import type {
  ModuleGraphDiagnostic,
  ModuleGraphManifest,
  ModuleGraphModule,
  ModuleGraphProvider,
  ModuleDiagnosticsSnapshot,
  ModuleLifecyclePhase,
  ModuleOptions,
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
  readonly providers: Set<ModuleToken<unknown>>;
  readonly exports: Set<ModuleToken<unknown>>;
  readonly controllers: Set<ModuleToken<unknown>>;
  readonly classProviders: Map<ModuleToken<unknown>, Constructor<unknown>>;
};

type ContainerServiceMetadataSnapshot = {
  readonly services?: readonly ServiceMetadata<unknown>[];
};

type ModuleProviderVisibilityFailure = {
  readonly moduleName: string;
  readonly providerClass: Constructor<unknown>;
  readonly token: ModuleToken<unknown>;
};

class CapturedTypediInjectionToken extends Error {
  constructor(readonly token: ModuleToken<unknown>) {
    super("Captured TypeDI injection token");
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const registeredModules = new Map<string, CrocoModuleInternal>();
const moduleStates = new Map<string, ModuleRuntimeState>();
const IGNORED_CONSTRUCTOR_DEPENDENCIES = new Set<unknown>([
  Array,
  Boolean,
  Number,
  Object,
  Promise,
  String,
]);
let isInitialized = false;
let initializedModules: ModuleOptions[] = [];
let activeContext: ModuleContext | null = null;

export function registerModule(module: ModuleOptions): void {
  validateModule(module);
  registeredModules.set(module.name, module);
  moduleStates.set(module.name, createModuleState(module));
  isInitialized = false;
}

export async function initializeModules(): Promise<ModuleContext> {
  const modules = collectModules(Array.from(registeredModules.values()));
  detectCircularDependency(modules);

  const sortedModules = sortModules(modules);
  const container = Container.of(undefined);
  const context = createRootContext(container);

  moduleStates.clear();
  for (const module of sortedModules) {
    moduleStates.set(module.name, createModuleState(module));
  }

  for (const module of sortedModules) {
    const moduleContext = createModuleContext(module.name, container);
    await runLifecycle(module, "setup", async () => {
      await registerProviders(module, moduleContext, container);
      await module.setup?.(moduleContext);
    });
  }

  for (const module of sortedModules) {
    const moduleContext = createModuleContext(module.name, container);
    await runLifecycle(module, "start", async () => {
      await module.start?.(moduleContext);
    });

    const state = moduleStates.get(module.name);
    if (state) {
      state.phase = "started";
      state.initialized = true;
      state.lastError = undefined;
    }
  }

  isInitialized = true;
  initializedModules = sortedModules;
  activeContext = context;
  return context;
}

export async function shutdownModules(): Promise<void> {
  if (!activeContext) {
    return;
  }

  const modules = [...initializedModules].reverse();

  for (const module of modules) {
    const container = Container.of(undefined);
    const moduleContext = createModuleContext(module.name, container);
    await runLifecycle(module, "shutdown", async () => {
      await module.shutdown?.(moduleContext);
    });

    const state = moduleStates.get(module.name);
    if (state) {
      state.phase = "stopped";
      state.initialized = false;
      state.lastError = undefined;
    }
  }

  isInitialized = false;
  initializedModules = [];
  activeContext = null;
}

export function resetModules(): void {
  registeredModules.clear();
  moduleStates.clear();
  isInitialized = false;
  initializedModules = [];
  activeContext = null;
}

export function isModuleInitialized(): boolean {
  return isInitialized;
}

export function getRegisteredModules(): readonly ModuleDiagnosticsSnapshot[] {
  return Array.from(moduleStates.values()).map((state) => ({
    name: state.module.name,
    initialized: state.initialized,
    phase: state.phase,
    imports: state.module.imports?.map((module) => module.name) ?? [],
    providers: Array.from(state.providers).map(getModuleTokenLabel),
    exports: Array.from(state.exports).map(getModuleTokenLabel),
    controllers: Array.from(state.controllers).map(getModuleTokenLabel),
    lastError: state.lastError,
  }));
}

export function createModuleGraphManifest(
  rootModules: readonly ModuleOptions[] = Array.from(registeredModules.values()),
): ModuleGraphManifest {
  const modules = collectModules(rootModules);
  const states = new Map(modules.map((module) => [module.name, createModuleState(module)]));
  const diagnostics = createModuleGraphDiagnostics(modules, states);

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
): ModuleGraphDiagnostic[] {
  const diagnostics: ModuleGraphDiagnostic[] = [];

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
      code: "framework-module/module-circular-dependency",
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

function collectModules(rootModules: readonly ModuleOptions[]): ModuleOptions[] {
  const modules = new Map<string, ModuleOptions>();

  const visit = (module: ModuleOptions): void => {
    validateModule(module);

    if (modules.has(module.name)) {
      return;
    }

    modules.set(module.name, module);

    for (const importedModule of module.imports ?? []) {
      visit(importedModule);
    }
  };

  for (const module of rootModules) {
    visit(module);
  }

  return Array.from(modules.values());
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

function createRootContext(container: ReturnType<typeof Container.of>): ModuleContext {
  return new ModuleContext(container);
}

function createModuleContext(
  moduleName: string,
  container: ReturnType<typeof Container.of>,
): ModuleContext {
  return new ModuleContext(container, {
    moduleName,
    canAccessToken: canAccessToken,
    isKnownToken: isKnownToken,
    registerProvider: registerProviderOwnership,
    validateClassProvider: validateClassProviderVisibility,
    validateProviderAccess: (ownerModuleName, token) => {
      validateProviderAccess(ownerModuleName, token, container);
    },
  });
}

async function registerProviders(
  module: ModuleOptions,
  context: ModuleContext,
  container: ReturnType<typeof Container.of>,
): Promise<void> {
  for (const provider of module.providers ?? []) {
    const token = getProviderToken(provider);
    registerProviderOwnership(module.name, token);

    if (!isProviderDefinition(provider)) {
      if (isConstructorToken(provider)) {
        validateClassProviderVisibility(module.name, provider);
        container.set({ id: provider, type: toTypediConstructable(provider) });
      }
      continue;
    }

    await registerProviderDefinition(module.name, provider, context, container);
  }
}

async function registerProviderDefinition<T>(
  moduleName: string,
  provider: ModuleProviderDefinition<T>,
  context: ModuleContext,
  container: ReturnType<typeof Container.of>,
): Promise<void> {
  if ("useValue" in provider) {
    context.set(provider.provide, provider.useValue);
    return;
  }

  if ("useClass" in provider) {
    validateClassProviderVisibility(moduleName, provider.useClass);
    container.set({ id: provider.provide, type: toTypediConstructable(provider.useClass) });
    return;
  }

  context.set(provider.provide, await provider.useFactory(context));
}

function registerProviderOwnership(moduleName: string, token: ModuleToken<unknown>): void {
  moduleStates.get(moduleName)?.providers.add(token);
}

function isKnownToken(token: ModuleToken<unknown>): boolean {
  return isKnownTokenInStates(token, moduleStates);
}

function isKnownTokenInStates(
  token: ModuleToken<unknown>,
  states: ReadonlyMap<string, ModuleRuntimeState>,
): boolean {
  return Array.from(states.values()).some(
    (state) => state.providers.has(token) || state.exports.has(token),
  );
}

function canAccessToken(moduleName: string, token: ModuleToken<unknown>): boolean {
  return canAccessTokenInStates(moduleName, token, moduleStates);
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

  if (state.providers.has(token)) {
    return true;
  }

  return (state.module.imports ?? []).some((module) => states.get(module.name)?.exports.has(token));
}

function validateProviderAccess(
  moduleName: string,
  token: ModuleToken<unknown>,
  container: ContainerInstance,
): void {
  const provider = getAccessibleClassProvider(moduleName, token);
  if (!provider) {
    if (hasUndeclaredTypediClassProvider(container, token)) {
      throw new ModuleProviderVisibilityProblem(moduleName, token);
    }

    return;
  }

  validateClassProviderVisibility(provider.moduleName, provider.providerClass);
}

function getAccessibleClassProvider(
  moduleName: string,
  token: ModuleToken<unknown>,
  states: ReadonlyMap<string, ModuleRuntimeState> = moduleStates,
): {
  readonly moduleName: string;
  readonly providerClass: Constructor<unknown>;
} | null {
  const state = states.get(moduleName);
  if (!state) {
    return null;
  }

  const localProviderClass = state.classProviders.get(token);
  if (localProviderClass) {
    return { moduleName, providerClass: localProviderClass };
  }

  for (const importedModule of state.module.imports ?? []) {
    const importedState = states.get(importedModule.name);
    if (!importedState?.exports.has(token)) {
      continue;
    }

    const providerClass = importedState.classProviders.get(token);
    if (providerClass) {
      return { moduleName: importedModule.name, providerClass };
    }
  }

  return null;
}

function validateClassProviderVisibility<T>(
  moduleName: string,
  providerClass: Constructor<T>,
): void {
  const failure = getClassProviderVisibilityFailures(moduleName, providerClass, moduleStates)[0];

  if (failure) {
    throw new ModuleProviderVisibilityProblem(moduleName, failure.token);
  }
}

function getClassProviderVisibilityFailures<T>(
  moduleName: string,
  providerClass: Constructor<T>,
  states: ReadonlyMap<string, ModuleRuntimeState>,
): ModuleProviderVisibilityFailure[] {
  const failures: ModuleProviderVisibilityFailure[] = [];
  const dependencies = getConstructorDependencies(providerClass);

  for (const dependency of dependencies) {
    if (!isConstructorToken(dependency) || IGNORED_CONSTRUCTOR_DEPENDENCIES.has(dependency)) {
      continue;
    }

    const dependencyToken = dependency as ModuleToken<unknown>;
    if (
      isKnownTokenInStates(dependencyToken, states) &&
      !canAccessTokenInStates(moduleName, dependencyToken, states)
    ) {
      failures.push({ moduleName, providerClass, token: dependencyToken });
    }
  }

  for (const dependency of getTypediHandlerDependencies(providerClass)) {
    if (
      isKnownTokenInStates(dependency, states) &&
      !canAccessTokenInStates(moduleName, dependency, states)
    ) {
      failures.push({ moduleName, providerClass, token: dependency });
    }
  }

  return failures;
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
  const services = (container as unknown as ContainerServiceMetadataSnapshot).services ?? [];

  return services.find((service) => service.id === token);
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
  module: ModuleOptions,
  phase: ModuleLifecyclePhase,
  run: () => Promise<void>,
): Promise<void> {
  const state = moduleStates.get(module.name);
  if (state) {
    state.phase = phase;
  }

  try {
    await run();
  } catch (error) {
    const problem = new ModuleLifecycleProblem(module.name, phase, error);
    if (state) {
      state.phase = "failed";
      state.initialized = false;
      state.lastError = problem.message;
    }
    throw problem;
  }
}
