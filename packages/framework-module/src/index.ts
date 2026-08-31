import type { ModuleContext } from "./ModuleContext";
import { defaultModuleRuntime } from "./ModuleRegistry";
import type { ModuleLifecycleExecutionOptions, ModuleOptions } from "./types";

export { ApplicationRuntime, createApplicationRuntime } from "./ApplicationRuntime";
export type {
  ApplicationRuntimeGraphManifest,
  ApplicationRuntimeOptions,
} from "./ApplicationRuntime";

export class CrocoModule {
  static use(module: ModuleOptions): void {
    defaultModuleRuntime.use(module);
  }

  static initialize(options: ModuleLifecycleExecutionOptions = {}): Promise<ModuleContext> {
    return defaultModuleRuntime.initialize(options);
  }

  static async shutdown(options: ModuleLifecycleExecutionOptions = {}): Promise<void> {
    await defaultModuleRuntime.shutdown(options);
  }

  static reset(): void {
    defaultModuleRuntime.reset();
  }

  static createGraphManifest() {
    return defaultModuleRuntime.createGraphManifest();
  }
}

export function defineCrocoModule(module: ModuleOptions): ModuleOptions {
  return Object.freeze({
    ...module,
    imports: module.imports ? Object.freeze([...module.imports]) : undefined,
    providers: module.providers ? Object.freeze([...module.providers]) : undefined,
    exports: module.exports ? Object.freeze([...module.exports]) : undefined,
    controllers: module.controllers ? Object.freeze([...module.controllers]) : undefined,
  });
}

export { detectCircularDependency } from "./CircularDependencyDetector";
export {
  createModuleGraphManifest,
  createModuleRuntime,
  stringifyModuleGraphManifest,
} from "./ModuleRegistry";
export type { ModuleRuntime } from "./ModuleRegistry";
export { ModuleContext } from "./ModuleContext";
export { ModuleDiagnosticsProvider } from "./libs/diagnostics/ModuleDiagnosticsProvider";
export {
  InvalidModuleDefinitionProblem,
  InvalidModuleLifecycleDeadlineProblem,
  ModuleCircularDependencyProblem,
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
} from "./problems";
export type {
  CrocoModule as CrocoModuleDefinition,
  ModuleCleanupFailure,
  ModuleDiagnosticsSnapshot,
  ModuleGraphDiagnostic,
  ModuleGraphDiagnosticCode,
  ModuleGraphManifest,
  ModuleGraphManifestStatus,
  ModuleGraphManifestVersion,
  ModuleGraphModule,
  ModuleGraphProvider,
  ModuleLifecycleFailure,
  ModuleLifecycleHook,
  ModuleLifecycleExecutionContext,
  ModuleLifecycleExecutionOptions,
  ModuleLifecyclePhase,
  ModuleOptions,
  ModuleProvider,
  ModuleProviderDefinition,
  ModuleProviderFactory,
  ModuleRuntimePhase,
} from "./types";
export type { ModuleToken } from "./types/ModuleToken";
