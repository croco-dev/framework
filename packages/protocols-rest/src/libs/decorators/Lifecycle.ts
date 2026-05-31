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

/**
 * 클래스 또는 메서드에 Guard 목록을 연결합니다.
 */
export function UseGuards(...guards: GuardConstructor[]): ClassDecorator & MethodDecorator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey) {
      Reflect.defineMetadata(REST_GUARDS_KEY, guards, target.constructor, propertyKey);
    } else {
      Reflect.defineMetadata(REST_GUARDS_KEY, guards, target);
    }
    return descriptor ?? target;
  };
}

/**
 * 클래스 또는 메서드에 Pipe 목록을 연결합니다.
 */
export function UsePipes(...pipes: PipeTransformConstructor[]): ClassDecorator & MethodDecorator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey) {
      Reflect.defineMetadata(REST_PIPES_KEY, pipes, target.constructor, propertyKey);
    } else {
      Reflect.defineMetadata(REST_PIPES_KEY, pipes, target);
    }
    return descriptor ?? target;
  };
}

/**
 * 클래스 또는 메서드에 Interceptor 목록을 연결합니다.
 */
export function UseInterceptors(
  ...interceptors: InterceptorConstructor[]
): ClassDecorator & MethodDecorator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey) {
      Reflect.defineMetadata(REST_INTERCEPTORS_KEY, interceptors, target.constructor, propertyKey);
    } else {
      Reflect.defineMetadata(REST_INTERCEPTORS_KEY, interceptors, target);
    }
    return descriptor ?? target;
  };
}

/**
 * 클래스 또는 메서드에 Exception Filter 목록을 연결합니다.
 */
export function UseFilters(
  ...filters: ExceptionFilterConstructor[]
): ClassDecorator & MethodDecorator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey) {
      Reflect.defineMetadata(REST_FILTERS_KEY, filters, target.constructor, propertyKey);
    } else {
      Reflect.defineMetadata(REST_FILTERS_KEY, filters, target);
    }
    return descriptor ?? target;
  };
}
