import "reflect-metadata";
import {
  REST_FILTERS_KEY,
  REST_GUARDS_KEY,
  REST_INTERCEPTORS_KEY,
  REST_PIPES_KEY,
} from "../constants";
import type {
  ExceptionFilterConstructor,
  GuardConstructor,
  InterceptorConstructor,
  PipeTransformConstructor,
} from "../types";

function appendLifecycleMetadata<T>(
  metadataKey: symbol,
  target: object,
  propertyKey: string | symbol | undefined,
  values: readonly T[],
): void {
  if (propertyKey === undefined) {
    const existing =
      (Reflect.getOwnMetadata(metadataKey, target) as readonly T[] | undefined) ?? [];
    Reflect.defineMetadata(metadataKey, [...existing, ...values], target);
    return;
  }

  const constructor = typeof target === "function" ? target : target.constructor;
  const existing =
    (Reflect.getOwnMetadata(metadataKey, constructor, propertyKey) as readonly T[] | undefined) ??
    [];
  Reflect.defineMetadata(metadataKey, [...existing, ...values], constructor, propertyKey);
}

function createLifecycleDecorator<T>(
  metadataKey: symbol,
  values: readonly T[],
): ClassDecorator & MethodDecorator {
  const decorator = (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ): PropertyDescriptor | undefined => {
    appendLifecycleMetadata(metadataKey, target, propertyKey, values);
    return descriptor;
  };

  return decorator as ClassDecorator & MethodDecorator;
}

/**
 * 클래스 또는 메서드에 Guard 목록을 연결합니다.
 */
export function UseGuards(...guards: GuardConstructor[]): ClassDecorator & MethodDecorator {
  return createLifecycleDecorator(REST_GUARDS_KEY, guards);
}

/**
 * 클래스 또는 메서드에 Pipe 목록을 연결합니다.
 */
export function UsePipes(...pipes: PipeTransformConstructor[]): ClassDecorator & MethodDecorator {
  return createLifecycleDecorator(REST_PIPES_KEY, pipes);
}

/**
 * 클래스 또는 메서드에 Interceptor 목록을 연결합니다.
 */
export function UseInterceptors(
  ...interceptors: InterceptorConstructor[]
): ClassDecorator & MethodDecorator {
  return createLifecycleDecorator(REST_INTERCEPTORS_KEY, interceptors);
}

/**
 * 클래스 또는 메서드에 Exception Filter 목록을 연결합니다.
 */
export function UseFilters(
  ...filters: ExceptionFilterConstructor[]
): ClassDecorator & MethodDecorator {
  return createLifecycleDecorator(REST_FILTERS_KEY, filters);
}
