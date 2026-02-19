import 'reflect-metadata';
import { Container } from '../Container';
import { ShutdownManager } from '../ShutdownManager';
import type { Constructor, ShutdownHook } from '../types';

const ON_SHUTDOWN_METHOD_KEY = Symbol('onShutdown:method');

function applyMethodDecorator(
  target: Constructor,
  _propertyKey: string | symbol,
  descriptor: PropertyDescriptor
): void {
  const originalMethod = descriptor.value;
  if (typeof originalMethod !== 'function') {
    return;
  }

  const hook: ShutdownHook = {
    onShutdown: async (): Promise<void> => {
      const instance = Container.get(target);
      await originalMethod.call(instance);
    },
  };

  ShutdownManager.getInstance().register(hook);
}

function applyClassDecorator(target: Constructor): void {
  const methodKey = Reflect.getMetadata(ON_SHUTDOWN_METHOD_KEY, target) as string | symbol | undefined;

  if (methodKey) {
    return;
  }

  const hook: ShutdownHook = {
    onShutdown: async (): Promise<void> => {
      const instance = Container.get(target);
      if (typeof (instance as ShutdownHook).onShutdown === 'function') {
        await (instance as ShutdownHook).onShutdown();
      }
    },
  };

  ShutdownManager.getInstance().register(hook);
}

export function OnShutdown(): MethodDecorator & ClassDecorator {
  return (target: object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor): void => {
    if (propertyKey !== undefined && descriptor !== undefined) {
      applyMethodDecorator(target as Constructor, propertyKey, descriptor);
    } else {
      applyClassDecorator(target as Constructor);
    }
  };
}
