import {
  type Service,
  Container as TypeDIContainer,
  ContainerInstance as TypeDIContainerInstance,
  Token as TypeDIToken,
} from "typedi";
import type { Constructable as TypeDIConstructable } from "typedi/types/types/constructable.type";
import "reflect-metadata";
import { ProblemFactory } from "@croco/problems-core";
import { Context } from "./Context";
import { MetadataStorage } from "./MetadataStorage";
import { CircularDependencyProblem } from "./problems/CircularDependencyProblem";
import type { ComponentMetadata, Constructor, Scope } from "./types";

export type TokenIdentifier<T> = Constructor<T> | TypeDIToken<T> | string | symbol;

const COMPONENT_METADATA_KEY = Symbol("component:metadata");

class HandlerContainerInstance extends TypeDIContainerInstance {
  override get<T>(id: Constructor<T> | TypeDIToken<T> | string): T {
    return Container.get(id);
  }
}

/**
 * Croco 컴포넌트의 등록, 조회, 지연 생성, 요청 스코프 해석을 담당하는 DI 컨테이너입니다.
 */
export class Container {
  private static validated = false;
  private static readonly lazyProviders = new Map<TokenIdentifier<unknown>, () => unknown>();
  private static readonly symbolTokens = new Map<symbol, TypeDIToken<unknown>>();

  static get<T>(token: TokenIdentifier<T>): T {
    if (Container.shouldResolveLazy(token)) {
      return Container.resolveLazy(token);
    }

    if (!Container.isConstructorToken(token)) {
      return Container.getRegisteredValue(token);
    }

    const constructorToken = token as Constructor<T>;

    const metadata = Container.getComponentMetadata(constructorToken);

    if (!metadata) {
      return TypeDIContainer.get(Container.toTypeDIConstructable(constructorToken));
    }

    switch (metadata.scope) {
      case "singleton":
        return TypeDIContainer.get(Container.toTypeDIConstructable(constructorToken));

      case "transient":
        return Container.createTransientInstance(constructorToken);

      case "request":
        return Container.getRequestScoped(constructorToken);

      default:
        return TypeDIContainer.get(Container.toTypeDIConstructable(constructorToken));
    }
  }

  static getMany<T>(tokens: Array<TokenIdentifier<T>>): T[] {
    return tokens.map((token) => Container.get(token));
  }

  static getOptional<T>(token: TokenIdentifier<T>): T | undefined {
    try {
      return Container.get(token);
    } catch (error) {
      if (Container.isOptionalResolutionError(error)) {
        return undefined;
      }

      throw error;
    }
  }

  static set<T>(token: TokenIdentifier<T>, instance: T): T {
    TypeDIContainer.set({ id: Container.resolveIdentifier(token), value: instance });
    Container.lazyProviders.delete(token);
    Container.validated = false;
    return instance;
  }

  static has<T>(token: TokenIdentifier<T>): boolean {
    return Container.lazyProviders.has(token) || Container.hasRegisteredValue(token);
  }

  static remove<T>(token: TokenIdentifier<T>): void {
    Container.removeRegisteredValue(token);
    Container.lazyProviders.delete(token);
    Container.validated = false;
  }

  static reset(): void {
    TypeDIContainer.reset();
    Container.lazyProviders.clear();
    Container.symbolTokens.clear();
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

  static async registerAsync<T>(token: TokenIdentifier<T>, factory: () => Promise<T>): Promise<T> {
    const instance = await factory();
    return Container.set(token, instance);
  }

  static registerLazy<T>(token: TokenIdentifier<T>, factory: () => T): void {
    Container.lazyProviders.set(token, factory);
    Container.validated = false;
  }

  private static isValidationEnabled(): boolean {
    const configured = process.env.CROCO_DI_VALIDATE;
    if (configured !== undefined) {
      return configured !== "0" && configured.toLowerCase() !== "false";
    }

    return process.env.NODE_ENV !== "production";
  }

  private static getRegisteredComponents(): Constructor[] {
    return MetadataStorage.getAll<{ scope: Scope; target: Constructor }>(
      COMPONENT_METADATA_KEY,
    ).map((entry) => entry.target as Constructor);
  }

  private static buildDependencyGraph(nodes: Constructor[]): Map<Constructor, Constructor[]> {
    const nodeSet = new Set(nodes);
    const graph = new Map<Constructor, Constructor[]>();

    for (const node of nodes) {
      const paramTypes =
        (Reflect.getMetadata("design:paramtypes", node) as Constructor[] | undefined) ?? [];
      const dependencies = paramTypes.filter(
        (dep): dep is Constructor => typeof dep === "function" && nodeSet.has(dep),
      );
      graph.set(node, dependencies);
    }

    return graph;
  }

  private static assertNoCircularDependency(
    nodes: Constructor[],
    graph: Map<Constructor, Constructor[]>,
  ): void {
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
          throw new CircularDependencyProblem(cycle.map((t) => t.name));
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

  static getDiagnosticsSnapshot(): {
    isInitialized: boolean;
    registeredServiceCount: number;
    scopes: string[];
  } {
    const components = Container.getRegisteredComponents();
    const scopes = new Set<string>();
    for (const comp of components) {
      const meta = Container.getComponentMetadata(comp);
      if (meta?.scope) {
        scopes.add(meta.scope);
      }
    }
    return {
      isInitialized: Container.validated,
      registeredServiceCount: components.length,
      scopes: Array.from(scopes),
    };
  }

  private static shouldResolveLazy<T>(token: TokenIdentifier<T>): boolean {
    return Container.lazyProviders.has(token) && !Container.hasRegisteredValue(token);
  }

  private static resolveLazy<T>(token: TokenIdentifier<T>): T {
    const factory = Container.lazyProviders.get(token);
    if (!factory) {
      return Container.getRegisteredValue(token);
    }

    const instance = factory() as T;
    Container.set(token, instance);
    return instance;
  }

  private static resolveIdentifier<T>(
    token: TokenIdentifier<T>,
  ): Constructor<T> | TypeDIToken<T> | string {
    if (typeof token === "symbol") {
      return Container.getOrCreateSymbolToken(token) as TypeDIToken<T>;
    }

    return token;
  }

  private static getOrCreateSymbolToken(symbol: symbol): TypeDIToken<unknown> {
    const existing = Container.symbolTokens.get(symbol);
    if (existing) {
      return existing;
    }

    const token = new TypeDIToken(Symbol.keyFor(symbol) ?? symbol.description ?? symbol.toString());
    Container.symbolTokens.set(symbol, token);
    return token;
  }

  private static isConstructorToken<T>(token: TokenIdentifier<T>): token is Constructor<T> {
    return typeof token === "function";
  }

  private static getRegisteredValue<T>(token: TokenIdentifier<T>): T {
    if (typeof token === "symbol") {
      return TypeDIContainer.get(Container.getOrCreateSymbolToken(token) as TypeDIToken<T>);
    }

    if (typeof token === "string") {
      return TypeDIContainer.get(token);
    }

    if (token instanceof TypeDIToken) {
      return TypeDIContainer.get(token);
    }

    return TypeDIContainer.get(Container.toTypeDIConstructable(token));
  }

  private static hasRegisteredValue<T>(token: TokenIdentifier<T>): boolean {
    if (typeof token === "symbol") {
      return TypeDIContainer.has(Container.getOrCreateSymbolToken(token));
    }

    if (typeof token === "string") {
      return TypeDIContainer.has(token);
    }

    if (token instanceof TypeDIToken) {
      return TypeDIContainer.has(token);
    }

    return TypeDIContainer.has(Container.toTypeDIConstructable(token));
  }

  private static removeRegisteredValue<T>(token: TokenIdentifier<T>): void {
    if (typeof token === "symbol") {
      TypeDIContainer.remove(Container.getOrCreateSymbolToken(token));
      return;
    }

    if (typeof token === "string") {
      TypeDIContainer.remove(token);
      return;
    }

    if (token instanceof TypeDIToken) {
      TypeDIContainer.remove(token);
      return;
    }

    TypeDIContainer.remove(Container.toTypeDIConstructable(token));
  }

  private static toTypeDIConstructable<T>(token: Constructor<T>): TypeDIConstructable<T> {
    return token as unknown as TypeDIConstructable<T>;
  }

  private static isOptionalResolutionError(error: unknown): error is Error {
    return (
      error instanceof Error &&
      (error.name === "ServiceNotFoundError" || error.name === "CannotInstantiateValueError")
    );
  }

  private static createTransientInstance<T>(token: Constructor<T>): T {
    const dependencies = Container.resolveDependencies(token);
    return Reflect.construct(token, dependencies) as T;
  }

  private static resolveDependencies<T>(token: Constructor<T>): unknown[] {
    const paramTypes =
      (Reflect.getMetadata("design:paramtypes", token) as Constructor[] | undefined) ?? [];
    const handlerContainer = Container.createHandlerContainer();

    return paramTypes.map((paramType: Constructor, index: number) => {
      const handler = TypeDIContainer.handlers.find(
        (candidate) =>
          (candidate.object === token || candidate.object === Object.getPrototypeOf(token)) &&
          candidate.index === index,
      );

      if (handler) {
        return handler.value(handlerContainer);
      }

      return Container.get(paramType);
    });
  }

  private static createHandlerContainer(): TypeDIContainerInstance {
    return new HandlerContainerInstance("__croco_handler__");
  }

  private static getRequestScoped<T>(token: Constructor<T>): T {
    const cache = Context.getCache();

    if (!cache) {
      throw ProblemFactory.internalServerError(
        "framework-context/request-scope-outside-context",
        "Request-scoped dependencies must be resolved inside Context.run().",
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
