import { Container } from "typedi";
import { detectCircularDependency } from "./CircularDependencyDetector";
import { ModuleContext } from "./ModuleContext";
import type { ModuleOptions } from "./types";

type CrocoModuleInternal = ModuleOptions;

const registeredModules = new Map<string, CrocoModuleInternal>();
let isInitialized = false;

export function registerModule(module: ModuleOptions): void {
  validateModule(module);
  registeredModules.set(module.name, module);
  isInitialized = false;
}

export async function initializeModules(): Promise<ModuleContext> {
  const modules = Array.from(registeredModules.values());
  detectCircularDependency(modules);

  const sortedModules = sortModules(modules);
  const context = new ModuleContext(Container.of(undefined));

  for (const module of sortedModules) {
    await module.setup?.(context);
  }

  for (const module of sortedModules) {
    await module.start?.(context);
  }

  isInitialized = true;
  return context;
}

export function resetModules(): void {
  registeredModules.clear();
  isInitialized = false;
}

export function isModuleInitialized(): boolean {
  return isInitialized;
}

function validateModule(module: ModuleOptions): void {
  if (typeof module.name !== "string" || module.name.trim().length === 0) {
    throw new Error("Module name must be a non-empty string.");
  }

  if (!module.setup && !module.start) {
    throw new Error(`Module '${module.name}' must define setup or start.`);
  }
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
