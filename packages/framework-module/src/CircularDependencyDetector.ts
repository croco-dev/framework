import type { ModuleOptions } from './types';

type Color = 'white' | 'gray' | 'black';

export function detectCircularDependency(modules: readonly ModuleOptions[]): string | null {
  const adjList = new Map<string, string[]>();

  for (const mod of modules) {
    adjList.set(
      mod.name,
      mod.imports?.map((importedModule) => importedModule.name) ?? []
    );
  }

  const color = new Map<string, Color>();
  for (const name of adjList.keys()) {
    color.set(name, 'white');
  }

  const stack: string[] = [];

  const visit = (name: string): void => {
    color.set(name, 'gray');
    stack.push(name);

    for (const dependencyName of adjList.get(name) ?? []) {
      const dependencyColor = color.get(dependencyName);

      if (dependencyColor === 'gray') {
        const cycle = stack.slice(stack.indexOf(dependencyName));
        cycle.push(dependencyName);
        throw new Error(`Circular dependency detected: ${cycle.join(' → ')}`);
      }

      if (dependencyColor === 'white') {
        visit(dependencyName);
      }
    }

    color.set(name, 'black');
    stack.pop();
  };

  for (const name of adjList.keys()) {
    if (color.get(name) === 'white') {
      visit(name);
    }
  }

  return null;
}
