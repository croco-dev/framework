import type { ModuleContext } from "./ModuleContext";
import {
  createModuleGraphManifest,
  initializeModules,
  registerModule,
  resetModules,
  shutdownModules,
} from "./ModuleRegistry";
import type { ModuleOptions } from "./types";

export class CrocoModule {
  static use(module: ModuleOptions): void {
    registerModule(module);
  }

  static initialize(): Promise<ModuleContext> {
    return initializeModules();
  }

  static async shutdown(): Promise<void> {
    await shutdownModules();
  }

  static reset(): void {
    resetModules();
  }

  static createGraphManifest() {
    return createModuleGraphManifest();
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
export { createModuleGraphManifest, stringifyModuleGraphManifest } from "./ModuleRegistry";
export { ModuleContext } from "./ModuleContext";
export { ModuleDiagnosticsProvider } from "./libs/diagnostics/ModuleDiagnosticsProvider";
export {
  InvalidModuleDefinitionProblem,
  ModuleCircularDependencyProblem,
  ModuleDuplicateNameProblem,
  ModuleLifecycleProblem,
  ModuleProviderOwnershipProblem,
  ModuleProviderVisibilityProblem,
  ModuleProviderWriteProblem,
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
  ModuleLifecycleHook,
  ModuleLifecyclePhase,
  ModuleOptions,
  ModuleProvider,
  ModuleProviderDefinition,
  ModuleProviderFactory,
  ModuleRuntimePhase,
} from "./types";
export type { ModuleToken } from "./types/ModuleToken";
