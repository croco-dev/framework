import { Container as TypeDIContainer, Service } from 'typedi';
import 'reflect-metadata';
import { Context } from './Context';
import { MetadataStorage } from './MetadataStorage';
import { Scope, Constructor } from './types';

const COMPONENT_METADATA_KEY = Symbol('component:metadata');

const REQUEST_SCOPED_CACHE = new Map<string, unknown>();

export class Container {
  static get<T>(token: Constructor<T>): T {
    const metadata = this.getComponentMetadata(token);

    if (!metadata) {
      return TypeDIContainer.get(token);
    }

    switch (metadata.scope) {
      case 'singleton':
        return TypeDIContainer.get(token);

      case 'transient':
        return this.createTransientInstance(token);

      case 'request':
        return this.getRequestScoped(token);

      default:
        return TypeDIContainer.get(token);
    }
  }

  static getMany<T>(tokens: Constructor<T>[]): T[] {
    return tokens.map(token => this.get(token));
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
    REQUEST_SCOPED_CACHE.clear();
  }

  static register<T>(token: Constructor<T>, scope: Scope): void {
    MetadataStorage.define(COMPONENT_METADATA_KEY, token, { scope, target: token });
  }

  private static getComponentMetadata(target: Constructor): { scope: Scope; target: Constructor } | undefined {
    return MetadataStorage.get(COMPONENT_METADATA_KEY, target);
  }

  private static createTransientInstance<T>(token: Constructor<T>): T {
    const paramTypes = Reflect.getMetadata('design:paramtypes', token) || [];
    const dependencies = paramTypes.map((paramType: Constructor) => this.get(paramType));
    return new token(...dependencies);
  }

  private static getRequestScoped<T>(token: Constructor<T>): T {
    const requestId = Context.getRequestId() ?? 'root';
    const cacheKey = `${requestId}:${token.name}`;

    const cached = REQUEST_SCOPED_CACHE.get(cacheKey);
    if (cached !== undefined) {
      return cached as T;
    }

    const instance = this.createTransientInstance(token);
    REQUEST_SCOPED_CACHE.set(cacheKey, instance);
    return instance;
  }
}

export { Service };
