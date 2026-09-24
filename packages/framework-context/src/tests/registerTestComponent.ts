import { Container } from "../libs/Container";
import { Component as ComponentMarker } from "../libs/decorators/Component";
import type { ComponentOptions, Constructor, Scope } from "../libs/types";

/** Test-only adapter for legacy runtime-container unit coverage. */
export function Component(options?: ComponentOptions): (target: Constructor) => void {
  return (target): void => {
    ComponentMarker(options)(target);
    const scope: Scope = options?.scope ?? "singleton";
    Container.register(target, scope);
  };
}
