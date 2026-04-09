import { Container } from '../Container';
import type { ComponentOptions, Constructor, Scope } from '../types';

/**
 * 클래스를 Croco DI 컨테이너에 등록하는 데코레이터입니다.
 */
export function Component(options?: ComponentOptions): (target: Constructor) => void {
  return (target: Constructor): void => {
    const scope: Scope = options?.scope ?? 'singleton';
    Container.register(target, scope);
  };
}

/**
 * 등록된 컴포넌트의 scope 메타데이터를 조회합니다.
 */
export function getComponentScope(target: Constructor): Scope | undefined {
  const metadata = Container.getComponentMetadata(target);
  return metadata?.scope;
}
