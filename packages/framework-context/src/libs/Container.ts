import {
  type Service,
  type ServiceIdentifier,
  type Token,
  Container as TypeDIContainer,
  type ContainerInstance as TypeDIContainerInstance,
} from 'typedi';
import 'reflect-metadata';
import { ProblemFactory } from '@croco/problems-core';
import { Context } from './Context';
import { MetadataStorage } from './MetadataStorage';
import type { ComponentMetadata, Constructor, Scope } from './types';

export type TokenIdentifier<T> = Constructor<T> | Token<T> | string;

const COMPONENT_METADATA_KEY = Symbol('component:metadata');

export class Container {
  private static validated = false;

  static get<T>(token: TokenIdentifier<T>): T {
    if (!(token instanceof Function)) {
      if (typeof token === 'string') {
        return TypeDIContainer.get(token);
      }

      return TypeDIContainer.get(token);
    }

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

  static getMany<T>(tokens: Array<TokenIdentifier<T>>): T[] {
    return tokens.map((token) => Container.get(token));
  }

  static set<T>(token: TokenIdentifier<T>, instance: T): T {
    TypeDIContainer.set({ id: token, value: instance });
    return instance;
  }

  static has<T>(token: TokenIdentifier<T>): boolean {
    if (token instanceof Function) {
      return TypeDIContainer.has(token);
    }

    if (typeof token === 'string') {
      return TypeDIContainer.has(token);
    }

    return TypeDIContainer.has(token);
  }

  static remove<T>(token: TokenIdentifier<T>): void {
    TypeDIContainer.remove(token);
  }

  static reset(): void {
    TypeDIContainer.reset();
    Container.validated = false;
  }

  static validate(): void {
    if (Container.validated) {
      return;
    }

    if (!Container.isValidationEnabled()) {
      return;
    }

    const nodes = Container.getRegisteredComponents();
    if (nodes.length === 0) {
      Container.validated = true;
      return;
    }

    const graph = Container.buildDependencyGraph(nodes);
    Container.assertNoCircularDependency(nodes, graph);

    Container.validated = true;
  }

  static register<T>(token: Constructor<T>, scope: Scope): void {
    MetadataStorage.define(COMPONENT_METADATA_KEY, token, { scope, target: token });
    Container.validated = false;
  }

  private static isValidationEnabled(): boolean {
    const configured = process.env.CROCO_DI_VALIDATE;
    if (configured !== undefined) {
      return configured !== '0' && configured.toLowerCase() !== 'false';
    }

    return process.env.NODE_ENV !== 'production';
  }

  private static getRegisteredComponents(): Constructor[] {
    return MetadataStorage.getAll<{ scope: Scope; target: Constructor }>(COMPONENT_METADATA_KEY).map(
      (entry) => entry.target as Constructor
    );
  }

  private static buildDependencyGraph(nodes: Constructor[]): Map<Constructor, Constructor[]> {
    const nodeSet = new Set(nodes);
    const graph = new Map<Constructor, Constructor[]>();

    for (const node of nodes) {
      const paramTypes = (Reflect.getMetadata('design:paramtypes', node) as Constructor[] | undefined) ?? [];
      const dependencies = paramTypes.filter(
        (dep): dep is Constructor => typeof dep === 'function' && nodeSet.has(dep)
      );
      graph.set(node, dependencies);
    }

    return graph;
  }

  private static assertNoCircularDependency(nodes: Constructor[], graph: Map<Constructor, Constructor[]>): void {
    const visitState = new Map<Constructor, 0 | 1 | 2>();
    const stack: Constructor[] = [];
    const stackIndex = new Map<Constructor, number>();

    const visit = (node: Constructor): void => {
      visitState.set(node, 1);
      stackIndex.set(node, stack.length);
      stack.push(node);

      const deps = graph.get(node) ?? [];
      for (const dep of deps) {
        const state = visitState.get(dep) ?? 0;
        if (state === 0) {
          visit(dep);
          continue;
        }

        if (state === 1) {
          const cycleStartIndex = stackIndex.get(dep) ?? 0;
          const cycle = stack.slice(cycleStartIndex).concat(dep);
          throw new Error(`Circular dependency detected: ${cycle.map((t) => t.name).join(' → ')}`);
        }
      }

      stack.pop();
      stackIndex.delete(node);
      visitState.set(node, 2);
    };

    for (const node of nodes) {
      if ((visitState.get(node) ?? 0) === 0) {
        visit(node);
      }
    }
  }

  static getComponentMetadata(target: Constructor): ComponentMetadata | undefined {
    return MetadataStorage.get(COMPONENT_METADATA_KEY, target);
  }

  private static createTransientInstance<T>(token: Constructor<T>): T {
    const dependencies = Container.resolveDependencies(token);
    return new token(...dependencies);
  }

  private static resolveDependencies<T>(token: Constructor<T>): unknown[] {
    const paramTypes = (Reflect.getMetadata('design:paramtypes', token) as Constructor[] | undefined) ?? [];
    const handlerContainer = Container.createHandlerContainer();

    return paramTypes.map((paramType: Constructor, index: number) => {
      const handler = TypeDIContainer.handlers.find(
        (candidate) =>
          (candidate.object === token || candidate.object === Object.getPrototypeOf(token)) && candidate.index === index
      );

      if (handler) {
        return handler.value(handlerContainer);
      }

      return Container.get(paramType);
    });
  }

  private static createHandlerContainer(): TypeDIContainerInstance {
    const containerLike = {
      get<T>(id: ServiceIdentifier<T>): T {
        return Container.get(id as TokenIdentifier<T>);
      },
    };

    return containerLike as unknown as TypeDIContainerInstance;
  }

  private static getRequestScoped<T>(token: Constructor<T>): T {
    const cache = Context.getCache();

    if (!cache) {
      throw ProblemFactory.internalServerError(
        'framework-context/request-scope-outside-context',
        'Request-scoped dependencies must be resolved inside Context.run().'
      );
    }

    const cached = cache.get(token);
    if (cached !== undefined) {
      return cached as T;
    }

    const instance = Container.createTransientInstance(token);
    cache.set(token, instance);
    return instance;
  }
}

export type { Service };
