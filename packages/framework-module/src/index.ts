import type { ModuleContext } from './ModuleContext';
import { initializeModules, registerModule, resetModules } from './ModuleRegistry';
import type { ModuleOptions } from './types';

export class CrocoModule {
  static use(module: ModuleOptions): void {
    registerModule(module);
  }

  static async initialize(): Promise<ModuleContext> {
    return initializeModules();
  }

  static reset(): void {
    resetModules();
  }
}

export { detectCircularDependency } from './CircularDependencyDetector';
export { ModuleContext } from './ModuleContext';
export type { CrocoModule as CrocoModuleDefinition, ModuleOptions } from './types';
export type { ModuleToken } from './types/ModuleToken';
