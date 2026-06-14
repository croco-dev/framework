import { ModuleCircularDependencyProblem } from "./problems";
import type { ModuleOptions } from "./types";

type Color = "white" | "gray" | "black";

export function detectCircularDependency(modules: readonly ModuleOptions[]): string | null {
  const adjList = new Map<string, string[]>();

  const visitModule = (module: ModuleOptions): void => {
    if (adjList.has(module.name)) {
      return;
    }

    adjList.set(module.name, module.imports?.map((importedModule) => importedModule.name) ?? []);

    for (const importedModule of module.imports ?? []) {
      visitModule(importedModule);
    }
  };

  for (const module of modules) {
    visitModule(module);
  }

  const color = new Map<string, Color>();
  for (const name of adjList.keys()) {
    color.set(name, "white");
  }

  const stack: string[] = [];

  const visit = (name: string): void => {
    color.set(name, "gray");
    stack.push(name);

    for (const dependencyName of adjList.get(name) ?? []) {
      const dependencyColor = color.get(dependencyName);

      if (dependencyColor === "gray") {
        const cycle = stack.slice(stack.indexOf(dependencyName));
        cycle.push(dependencyName);
        throw new ModuleCircularDependencyProblem(cycle);
      }

      if (dependencyColor === "white") {
        visit(dependencyName);
      }
    }

    color.set(name, "black");
    stack.pop();
  };

  for (const name of adjList.keys()) {
    if (color.get(name) === "white") {
      visit(name);
    }
  }

  return null;
}
