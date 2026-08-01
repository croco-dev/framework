import { Container } from "../Container";
import type { ComponentOptions, Constructor, Scope } from "../types";

const DECLARED_COMPONENT_SCOPE_KEY = Symbol.for("croco:component:declared-scope");

/**
 * 클래스를 Croco DI 컨테이너에 등록하는 데코레이터입니다.
 */
export function Component(options?: ComponentOptions): (target: Constructor) => void {
  return (target: Constructor): void => {
    const scope: Scope = options?.scope ?? "singleton";
    Reflect.defineMetadata(DECLARED_COMPONENT_SCOPE_KEY, scope, target);
    Container.register(target, scope);
  };
}

/**
 * 컨테이너 초기화와 무관하게 컴포넌트 데코레이터에 선언된 scope를 조회합니다.
 */
export function getDeclaredComponentScope(target: Constructor): Scope | undefined {
  return Reflect.getOwnMetadata(DECLARED_COMPONENT_SCOPE_KEY, target) as Scope | undefined;
}

/**
 * 등록된 컴포넌트의 scope 메타데이터를 조회합니다.
 */
export function getComponentScope(target: Constructor): Scope | undefined {
  const metadata = Container.getComponentMetadata(target);
  return metadata?.scope;
}
