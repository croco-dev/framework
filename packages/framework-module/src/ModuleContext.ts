import type { ContainerInstance } from "typedi";
import type { ModuleToken } from "./types/ModuleToken";

export class ModuleContext {
  private readonly container: ContainerInstance;

  constructor(container: ContainerInstance) {
    this.container = container;
  }

  get<T>(token: ModuleToken<T>): T {
    return this.container.get(token);
  }

  set<T>(token: ModuleToken<T>, value: T): void {
    this.container.set(token, value);
  }
}
