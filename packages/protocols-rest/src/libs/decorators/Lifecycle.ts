import 'reflect-metadata';
import { REST_FILTERS_KEY, REST_GUARDS_KEY, REST_INTERCEPTORS_KEY, REST_PIPES_KEY } from '../constants';
import type {
  ExceptionFilterConstructor,
  GuardConstructor,
  InterceptorConstructor,
  PipeTransformConstructor,
} from '../types';

export function UseGuards(...guards: GuardConstructor[]): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey) {
      Reflect.defineMetadata(REST_GUARDS_KEY, guards, target.constructor, propertyKey);
    } else {
      Reflect.defineMetadata(REST_GUARDS_KEY, guards, target);
    }
    return descriptor ?? target;
  };
}

export function UsePipes(...pipes: PipeTransformConstructor[]): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey) {
      Reflect.defineMetadata(REST_PIPES_KEY, pipes, target.constructor, propertyKey);
    } else {
      Reflect.defineMetadata(REST_PIPES_KEY, pipes, target);
    }
    return descriptor ?? target;
  };
}

export function UseInterceptors(...interceptors: InterceptorConstructor[]): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey) {
      Reflect.defineMetadata(REST_INTERCEPTORS_KEY, interceptors, target.constructor, propertyKey);
    } else {
      Reflect.defineMetadata(REST_INTERCEPTORS_KEY, interceptors, target);
    }
    return descriptor ?? target;
  };
}

export function UseFilters(...filters: ExceptionFilterConstructor[]): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey) {
      Reflect.defineMetadata(REST_FILTERS_KEY, filters, target.constructor, propertyKey);
    } else {
      Reflect.defineMetadata(REST_FILTERS_KEY, filters, target);
    }
    return descriptor ?? target;
  };
}
