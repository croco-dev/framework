import { Service, Container as TypeDIContainer } from 'typedi';
import 'reflect-metadata';
import { Context } from './Context';
import { MetadataStorage } from './MetadataStorage';
import type { Constructor, Scope } from './types';

const COMPONENT_METADATA_KEY = Symbol('component:metadata');

export class Container {
  static get<T>(token: Constructor<T>): T {
    const metadata = Container.getComponentMetadata(token);

    if (!metadata) {
      return TypeDIContainer.get(token);
    }

    switch (metadata.scope) {
      case 'singleton':
        return TypeDIContainer.get(token);

      case 'transient':
        return Container.createTransientInstance(token);

      case 'request':
        return Container.getRequestScoped(token);

      default:
        return TypeDIContainer.get(token);
    }
  }

  static getMany<T>(tokens: Constructor<T>[]): T[] {
    return tokens.map((token) => Container.get(token));
  }

  static set<T>(token: Constructor<T>, instance: T): T {
    TypeDIContainer.set({ id: token, value: instance });
    return instance;
  }

  static remove(token: Constructor): void {
    TypeDIContainer.reset(token as unknown as string);
  }

  static reset(): void {
    TypeDIContainer.reset();
  }

  static register<T>(token: Constructor<T>, scope: Scope): void {
    MetadataStorage.define(COMPONENT_METADATA_KEY, token, { scope, target: token });
  }

  private static getComponentMetadata(target: Constructor): { scope: Scope; target: Constructor } | undefined {
    return MetadataStorage.get(COMPONENT_METADATA_KEY, target);
  }

  private static createTransientInstance<T>(token: Constructor<T>): T {
    const paramTypes = Reflect.getMetadata('design:paramtypes', token) || [];
    const dependencies = paramTypes.map((paramType: Constructor) => Container.get(paramType));
    return new token(...dependencies);
  }

  private static getRequestScoped<T>(token: Constructor<T>): T {
    const cache = Context.getCache();

    if (!cache) {
      console.warn('[Container] getRequestScoped called outside Context.run(). Returning transient instance.');
      return Container.createTransientInstance(token);
    }

    const key = token.name;

    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached as T;
    }

    const instance = Container.createTransientInstance(token);
    cache.set(key, instance);
    return instance;
  }
}

export { Service };
