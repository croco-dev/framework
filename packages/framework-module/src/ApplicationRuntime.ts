import {
  Container,
  type ContainerScope,
  type Constructor,
  type DependencyGraphManifest,
  type TokenIdentifier,
} from "@croco/framework-context";
import { createModuleRuntimeForContainer, type ModuleRuntime } from "./ModuleRegistry";
import { getProviderToken, isConstructorToken, isProviderDefinition } from "./moduleTokens";
import { attachModuleCleanupFailures, ModuleLifecycleProblem } from "./problems";
import type {
  ModuleCleanupFailure,
  ModuleDiagnosticsSnapshot,
  ModuleGraphManifest,
  ModuleOptions,
} from "./types";

export type ApplicationRuntimeOptions = {
  readonly modules?: readonly ModuleOptions[];
};

export type ApplicationRuntimeGraphManifest = {
  readonly version: "croco.application-runtime.graph.v1";
  readonly status: "ready" | "failed";
  readonly moduleGraph: ModuleGraphManifest;
  readonly dependencyGraph: DependencyGraphManifest;
};

/**
 * Owns one isolated DI scope and one module lifecycle for a Croco application.
 */
export class ApplicationRuntime implements AsyncDisposable {
  readonly scopeId: string;
  private readonly containerScope: ContainerScope;
  private readonly moduleRuntime: ModuleRuntime;
  private readonly graphProviderConstructors = new Map<
    TokenIdentifier<unknown>,
    Constructor<unknown>
  >();
  private readonly graphLeafProviders = new Set<TokenIdentifier<unknown>>();
  private readonly graphRoots = new Set<TokenIdentifier<unknown>>();
  private disposal: Promise<void> | undefined;
  private initialization: Promise<void> | undefined;
  private disposed = false;

  constructor(options: ApplicationRuntimeOptions = {}) {
    this.containerScope = Container.createScope();
    this.scopeId = this.containerScope.id;
    this.moduleRuntime = createModuleRuntimeForContainer(this.scopeId);

    for (const module of options.modules ?? []) {
      this.use(module);
    }
  }

  use(module: ModuleOptions): void {
    this.moduleRuntime.use(module);
    this.collectGraphRoots(module, new Set());
  }

  initialize(): Promise<void> {
    if (this.initialization) {
      return this.initialization;
    }

    const attempt = this.initializeOnce();
    this.initialization = attempt;
    void attempt.then(
      () => this.clearInitialization(attempt),
      () => this.clearInitialization(attempt),
    );
    return attempt;
  }

  private async initializeOnce(): Promise<void> {
    try {
      await this.containerScope.runWithRollback(() => this.moduleRuntime.initialize());
    } catch (error) {
      if (this.hasCleanupFailures(error)) {
        try {
          await this.dispose();
        } catch (disposalError) {
          throw this.attachDisposalFailure(error, disposalError);
        }
      }
      throw error;
    }
  }

  private clearInitialization(attempt: Promise<void>): void {
    if (this.initialization === attempt) {
      this.initialization = undefined;
    }
  }

  shutdown(): Promise<void> {
    return this.containerScope.run(() => this.moduleRuntime.shutdown());
  }

  run<T>(fn: () => Promise<T>): Promise<T>;
  run<T>(fn: () => T): T;
  run<T>(fn: () => Promise<T> | T): Promise<T> | T {
    return this.containerScope.run(fn);
  }

  get<T>(token: TokenIdentifier<T>): T {
    return this.containerScope.run(() => Container.get(token));
  }

  has<T>(token: TokenIdentifier<T>): boolean {
    return this.containerScope.run(() => Container.has(token));
  }

  createGraphManifest(
    options: { readonly roots?: readonly TokenIdentifier<unknown>[] } = {},
  ): ApplicationRuntimeGraphManifest {
    return this.containerScope.run(() => {
      const moduleGraph = this.moduleRuntime.createGraphManifest();
      const dependencyGraph = Container.createDependencyGraphManifest({
        knownProviders: this.graphLeafProviders,
        providerConstructors: this.graphProviderConstructors,
        rejectUnknownProviders: true,
        roots: options.roots ?? [...this.graphRoots],
      });

      const manifest: ApplicationRuntimeGraphManifest = {
        version: "croco.application-runtime.graph.v1",
        status:
          moduleGraph.status === "ready" && dependencyGraph.status === "ready" ? "ready" : "failed",
        moduleGraph,
        dependencyGraph,
      };
      return manifest;
    });
  }

  getRegisteredModules(): readonly ModuleDiagnosticsSnapshot[] {
    return this.containerScope.run(() => this.moduleRuntime.getRegisteredModules());
  }

  async dispose(): Promise<void> {
    if (this.disposal) {
      await this.disposal;
      return;
    }

    if (this.disposed) {
      return;
    }

    this.disposal = this.disposeOnce();
    await this.disposal;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }

  private collectGraphRoots(module: ModuleOptions, visited: Set<ModuleOptions>): void {
    if (visited.has(module)) {
      return;
    }
    visited.add(module);

    for (const provider of module.providers ?? []) {
      const token = getProviderToken(provider) as TokenIdentifier<unknown>;
      this.graphRoots.add(token);
      if (isProviderDefinition(provider)) {
        if ("useClass" in provider) {
          this.graphProviderConstructors.set(token, provider.useClass);
        } else {
          this.graphLeafProviders.add(token);
        }
      } else if (isConstructorToken(provider)) {
        this.graphProviderConstructors.set(token, provider);
      }
    }
    for (const controller of module.controllers ?? []) {
      const token = controller as TokenIdentifier<unknown>;
      this.graphRoots.add(token);
      if (isConstructorToken(controller)) {
        this.graphProviderConstructors.set(token, controller);
      }
    }
    for (const importedModule of module.imports ?? []) {
      this.collectGraphRoots(importedModule, visited);
    }
  }

  private hasCleanupFailures(error: unknown): boolean {
    if (!(error instanceof Error) || !("extensions" in error)) {
      return false;
    }

    const extensions = error.extensions;
    if (!extensions || typeof extensions !== "object" || !("cleanupFailures" in extensions)) {
      return false;
    }

    return Array.isArray(extensions.cleanupFailures) && extensions.cleanupFailures.length > 0;
  }

  private attachDisposalFailure(error: unknown, disposalError: unknown): ModuleLifecycleProblem {
    const disposalCode =
      disposalError instanceof ModuleLifecycleProblem
        ? disposalError.code
        : disposalError instanceof Error &&
            "code" in disposalError &&
            typeof disposalError.code === "string"
          ? disposalError.code
          : "framework-module/application-runtime-disposal-failed";
    const failure: ModuleCleanupFailure = {
      moduleName: "<application-runtime>",
      phase: "shutdown",
      code: disposalCode,
      message: disposalError instanceof Error ? disposalError.message : String(disposalError),
    };

    if (error instanceof ModuleLifecycleProblem) {
      const existingFailures = Array.isArray(error.extensions?.cleanupFailures)
        ? (error.extensions.cleanupFailures as unknown as ModuleCleanupFailure[])
        : [];
      return attachModuleCleanupFailures(error, [...existingFailures, failure]);
    }

    return new ModuleLifecycleProblem("<application-runtime>", "shutdown", error, [failure]);
  }

  private async disposeOnce(): Promise<void> {
    try {
      await this.containerScope.run(() => this.moduleRuntime.dispose());
    } finally {
      this.disposed = true;
      this.containerScope.dispose();
    }
  }
}

export function createApplicationRuntime(
  options: ApplicationRuntimeOptions = {},
): ApplicationRuntime {
  return new ApplicationRuntime(options);
}
