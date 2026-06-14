import type { ModuleContext } from "./ModuleContext";
import type { Constructor, ModuleToken } from "./types/ModuleToken";

export type ModuleLifecyclePhase = "setup" | "start" | "shutdown";

export type ModuleLifecycleHook = (ctx: ModuleContext) => void | Promise<void>;

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
