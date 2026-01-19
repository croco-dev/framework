import { Container } from '../Container';
import { ComponentOptions, Scope, Constructor } from '../types';

export function Component(options?: ComponentOptions): (target: Constructor) => void {
  return function (target: Constructor): void {
    const scope: Scope = options?.scope ?? 'singleton';
    Container.register(target, scope);
  };
}

export function getComponentScope(target: Constructor): Scope | undefined {
  const containerAny = Container as unknown as { getComponentMetadata?: (t: Constructor) => { scope?: Scope } };
  const metadata = containerAny.getComponentMetadata?.(target);
  return metadata?.scope;
}
