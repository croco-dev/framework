import type { ModuleContext } from "./ModuleContext";
import type { ModuleCleanupFailure, ModuleLifecyclePhase } from "./types/ModuleLifecycle";
import type { Constructor, ModuleToken } from "./types/ModuleToken";

export type {
  ModuleCleanupFailure,
  ModuleLifecycleExecutionOptions,
  ModuleLifecycleFailure,
  ModuleLifecyclePhase,
} from "./types/ModuleLifecycle";

export type ModuleLifecycleExecutionContext = {
  readonly phase: ModuleLifecyclePhase;
  readonly moduleContext: ModuleContext;
  readonly signal: AbortSignal;
  readonly deadline?: number;
};

export type ModuleLifecycleHook = (
  ctx: ModuleContext,
  execution: ModuleLifecycleExecutionContext,
) => void | Promise<void>;

export type ModuleProviderFactory<T = unknown> = (ctx: ModuleContext) => T | Promise<T>;

export type ModuleProviderDefinition<T = unknown> =
  | {
      readonly provide: ModuleToken<T>;
      readonly useValue: T;
    }
  | {
      readonly provide: ModuleToken<T>;
      readonly useClass: Constructor<T>;
    }
  | {
      readonly provide: ModuleToken<T>;
      readonly useFactory: ModuleProviderFactory<T>;
    };

export type ModuleProvider<T = unknown> = ModuleToken<T> | ModuleProviderDefinition<T>;

export type ModuleRuntimePhase =
  | "registered"
  | ModuleLifecyclePhase
  | "rollback"
  | "started"
  | "stopped"
  | "failed";

export type ModuleDiagnosticsSnapshot = {
  readonly name: string;
  readonly initialized: boolean;
  readonly phase: ModuleRuntimePhase;
  readonly imports: readonly string[];
  readonly providers: readonly string[];
  readonly exports: readonly string[];
  readonly controllers: readonly string[];
  readonly lastError?: string;
  readonly cleanupFailures?: readonly ModuleCleanupFailure[];
};

export type ModuleGraphManifestVersion = "croco.module-graph.manifest.v1";

export type ModuleGraphManifestStatus = "ready" | "failed";

export type ModuleGraphDiagnosticCode =
  | "framework-module/circular-dependency"
  | "framework-module/provider-ownership-conflict"
  | "framework-module/provider-not-visible";

export type ModuleGraphDiagnostic = {
  readonly code: ModuleGraphDiagnosticCode;
  readonly severity: "error";
  readonly moduleName: string;
  readonly token?: string;
  readonly message: string;
  readonly path: readonly string[];
};

export type ModuleGraphProvider = {
  readonly token: string;
  readonly provider: "class" | "value" | "factory" | "token";
  readonly className?: string;
};

export type ModuleGraphModule = {
  readonly name: string;
  readonly imports: readonly string[];
  readonly providers: readonly ModuleGraphProvider[];
  readonly exports: readonly string[];
  readonly controllers: readonly string[];
};

export type ModuleGraphManifest = {
  readonly version: ModuleGraphManifestVersion;
  readonly status: ModuleGraphManifestStatus;
  readonly modules: readonly ModuleGraphModule[];
  readonly diagnostics: readonly ModuleGraphDiagnostic[];
};

export type ModuleOptions = {
  /**
   * Stable module identifier used for dependency ordering, diagnostics, and
   * lifecycle failure messages.
   */
  readonly name: string;
  /**
   * Imported modules are initialized first. Only tokens listed in an imported
   * module's `exports` are visible to this module context.
   */
  readonly imports?: readonly CrocoModule[];
  /**
   * Providers owned by this module. Token-only class providers are registered
   * by class; string and Token providers document ownership and can be bound
   * with `ModuleContext.set` or a provider definition.
   */
  readonly providers?: readonly ModuleProvider[];
  /**
   * Provider tokens that become visible to direct importers.
   */
  readonly exports?: readonly ModuleToken<unknown>[];
  /**
   * Controller tokens owned by this module. The module package records these
   * for diagnostics; transport packages decide how to bind them.
   */
  readonly controllers?: readonly ModuleToken<unknown>[];
  readonly setup?: ModuleLifecycleHook;
  readonly start?: ModuleLifecycleHook;
  readonly shutdown?: ModuleLifecycleHook;
};

export interface CrocoModule {
  readonly name: string;
  readonly imports?: readonly CrocoModule[];
  readonly providers?: readonly ModuleProvider[];
  readonly exports?: readonly ModuleToken<unknown>[];
  readonly controllers?: readonly ModuleToken<unknown>[];
  readonly setup?: ModuleLifecycleHook;
  readonly start?: ModuleLifecycleHook;
  readonly shutdown?: ModuleLifecycleHook;
}
