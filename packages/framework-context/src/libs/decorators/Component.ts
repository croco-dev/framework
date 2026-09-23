import type { ComponentOptions, Constructor, Scope } from "../types";

const DECLARED_COMPONENT_SCOPE_KEY = Symbol.for("croco:component:declared-scope");

/**
 * Croco 컴파일러가 자동 발견할 컴포넌트를 표시하는 데코레이터입니다.
 */
export function Component(options?: ComponentOptions): (target: Constructor) => void {
  return (target: Constructor): void => {
    const scope: Scope = options?.scope ?? "singleton";
    Reflect.defineMetadata(DECLARED_COMPONENT_SCOPE_KEY, scope, target);
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
  return getDeclaredComponentScope(target);
}
