import { Container } from '../Container';
import type { ComponentOptions, Constructor, Scope } from '../types';

export function Component(options?: ComponentOptions): (target: Constructor) => void {
  return (target: Constructor): void => {
    const scope: Scope = options?.scope ?? 'singleton';
    Container.register(target, scope);
  };
}

export function getComponentScope(target: Constructor): Scope | undefined {
  const metadata = Container.getComponentMetadata(target);
  return metadata?.scope;
}
