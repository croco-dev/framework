import type { Constructor } from "./types";
import { inspectInjectionMetadata } from "./InjectionMetadata";
import { Token } from "./Token";

export type Constructable<T> = new (...args: never[]) => T;
export type ServiceIdentifier<T = unknown> = Constructor<T> | Token<T> | string | symbol;

const EMPTY_VALUE = Symbol("croco.di.empty-value");

export type ServiceMetadata<T = unknown> = {
  id: ServiceIdentifier<T>;
  value: T | typeof EMPTY_VALUE;
  type?: Constructable<T>;
  factory?: () => T;
  multiple: boolean;
  scope: "singleton" | "container" | "transient";
};

export type ServiceOptions<T> = {
  readonly id: ServiceIdentifier<T>;
  readonly value?: T;
  readonly type?: Constructable<unknown>;
  readonly factory?: () => T;
  readonly global?: boolean;
  readonly multiple?: boolean;
  readonly scope?: ServiceMetadata<T>["scope"];
};

export class ServiceNotFoundError extends Error {
  constructor(readonly identifier: ServiceIdentifier<unknown>) {
    super(`Service with identifier '${formatIdentifier(identifier)}' was not found.`);
    this.name = "ServiceNotFoundError";
  }
}

export class CannotInstantiateValueError extends Error {
  constructor(readonly identifier: ServiceIdentifier<unknown>) {
    super(`Service with identifier '${formatIdentifier(identifier)}' has no value or factory.`);
    this.name = "CannotInstantiateValueError";
  }
}

function formatIdentifier(identifier: ServiceIdentifier<unknown>): string {
  if (typeof identifier === "function") {
    return identifier.name || "<anonymous>";
  }
  if (typeof identifier === "symbol") {
    return Symbol.keyFor(identifier) ?? identifier.description ?? identifier.toString();
  }
  return identifier instanceof Token ? identifier.toString() : identifier;
}

export class ContainerInstance {
  readonly services: ServiceMetadata<unknown>[] = [];

  constructor(readonly id: string = "default") {}

  set<T>(options: ServiceOptions<T>): this;
  set<T>(identifier: ServiceIdentifier<T>, value: T): this;
  set<T>(optionsOrIdentifier: ServiceOptions<T> | ServiceIdentifier<T>, value?: T): this {
    const options = isServiceOptions(optionsOrIdentifier)
      ? optionsOrIdentifier
      : { id: optionsOrIdentifier, value: value as T };
    const metadata: ServiceMetadata<T> = {
      id: options.id,
      value: "value" in options ? (options.value as T) : EMPTY_VALUE,
      multiple: options.multiple ?? false,
      scope: options.scope ?? "container",
      ...(options.type ? { type: options.type as Constructable<T> } : {}),
      ...(options.factory ? { factory: options.factory } : {}),
    };

    if (!metadata.multiple) {
      const existingIndex = this.services.findIndex(
        (service) => service.id === metadata.id && !service.multiple,
      );
      if (existingIndex >= 0) {
        this.services.splice(existingIndex, 1, metadata as ServiceMetadata<unknown>);
        return this;
      }
    }

    this.services.push(metadata as ServiceMetadata<unknown>);
    return this;
  }

  get<T>(identifier: ServiceIdentifier<T>): T {
    const service = this.services.find((candidate) => candidate.id === identifier);
    if (!service) {
      throw new ServiceNotFoundError(identifier);
    }
    return this.getServiceValue(service as ServiceMetadata<T>);
  }

  getMany<T>(identifier: ServiceIdentifier<T>): T[] {
    return this.services
      .filter((service) => service.id === identifier)
      .map((service) => this.getServiceValue(service as ServiceMetadata<T>));
  }

  has<T>(identifier: ServiceIdentifier<T>): boolean {
    return this.services.some((service) => service.id === identifier);
  }

  remove<T>(identifier: ServiceIdentifier<T>): this {
    const removed = this.services.filter((service) => service.id === identifier);
    for (const service of removed) {
      this.destroyServiceInstance(service);
    }
    this.services.splice(
      0,
      this.services.length,
      ...this.services.filter((service) => service.id !== identifier),
    );
    return this;
  }

  reset(
    _options?: { readonly strategy?: "resetServices" },
    disposedValues = new Set<unknown>(),
  ): this {
    const failures: unknown[] = [];
    for (const service of [...this.services].reverse()) {
      try {
        this.destroyServiceInstance(service, disposedValues);
      } catch (error) {
        failures.push(error);
      }
    }
    this.services.splice(0, this.services.length);
    if (failures.length > 0) {
      throw failures[0];
    }
    return this;
  }

  getServiceValue<T>(service: ServiceMetadata<T>): T {
    if (service.value !== EMPTY_VALUE) {
      return service.value;
    }

    let value: T;
    if (service.factory) {
      value = service.factory();
    } else if (service.type) {
      value = this.instantiate(service.type);
    } else {
      throw new CannotInstantiateValueError(service.id);
    }

    if (service.scope !== "transient") {
      service.value = value;
    }
    return value;
  }

  destroyServiceInstance(service: ServiceMetadata<unknown>, disposedValues?: Set<unknown>): void {
    if (service.value === EMPTY_VALUE) {
      return;
    }

    const value = service.value;
    service.value = EMPTY_VALUE;
    if ((typeof value !== "object" && typeof value !== "function") || value === null) {
      return;
    }
    const disposable = value as {
      [Symbol.dispose]?: () => void;
      destroy?: () => void;
    };
    if (disposedValues?.has(value)) {
      return;
    }
    disposedValues?.add(value);
    const dispose = disposable[Symbol.dispose];
    if (typeof dispose === "function") {
      dispose.call(disposable);
      return;
    }
    disposable.destroy?.();
  }

  private instantiate<T>(target: Constructable<T>): T {
    const constructorInjections = inspectInjectionMetadata(target);
    const propertyInjections = inspectInjectionMetadata(target.prototype);
    const parameterCount = Math.max(
      target.length,
      ...constructorInjections.map((injection) => (injection.index ?? -1) + 1),
    );
    const args = Array.from({ length: parameterCount }, (_, index) => {
      const injection = constructorInjections.find((candidate) => candidate.index === index);
      if (injection?.status === "resolved") {
        if (injection.optional && !this.has(injection.token as ServiceIdentifier<unknown>)) {
          return undefined;
        }
        return injection.many
          ? this.getMany(injection.token as ServiceIdentifier<unknown>)
          : this.get(injection.token as ServiceIdentifier<unknown>);
      }
      throw new CannotInstantiateValueError(target);
    });
    const instance = Reflect.construct(target, args) as T;
    for (const injection of propertyInjections) {
      if (injection.propertyKey === undefined) {
        continue;
      }
      if (injection.status !== "resolved") {
        throw new CannotInstantiateValueError(target);
      }
      const value =
        injection.optional && !this.has(injection.token as ServiceIdentifier<unknown>)
          ? undefined
          : injection.many
            ? this.getMany(injection.token as ServiceIdentifier<unknown>)
            : this.get(injection.token as ServiceIdentifier<unknown>);
      Reflect.set(instance as object, injection.propertyKey, value);
    }
    return instance;
  }
}

function isServiceOptions<T>(
  value: ServiceOptions<T> | ServiceIdentifier<T>,
): value is ServiceOptions<T> {
  return typeof value === "object" && value !== null && "id" in value;
}

const containers = new Map<string, ContainerInstance>();
const defaultContainer = new ContainerInstance();
containers.set(defaultContainer.id, defaultContainer);

export class RuntimeContainer {
  static get instances(): readonly ContainerInstance[] {
    return [...containers.values()];
  }

  static get handlers(): readonly never[] {
    return [];
  }

  static of(id = "default"): ContainerInstance {
    const existing = containers.get(id);
    if (existing) {
      return existing;
    }
    const container = new ContainerInstance(id);
    containers.set(id, container);
    return container;
  }

  static set<T>(options: ServiceOptions<T>): typeof RuntimeContainer;
  static set<T>(identifier: ServiceIdentifier<T>, value: T): typeof RuntimeContainer;
  static set<T>(
    optionsOrIdentifier: ServiceOptions<T> | ServiceIdentifier<T>,
    value?: T,
  ): typeof RuntimeContainer {
    if (isServiceOptions(optionsOrIdentifier)) {
      defaultContainer.set(optionsOrIdentifier);
    } else {
      defaultContainer.set(optionsOrIdentifier, value as T);
    }
    return RuntimeContainer;
  }

  static get<T>(identifier: ServiceIdentifier<T>): T {
    return defaultContainer.get(identifier);
  }

  static getMany<T>(identifier: ServiceIdentifier<T>): T[] {
    return defaultContainer.getMany(identifier);
  }

  static has<T>(identifier: ServiceIdentifier<T>): boolean {
    return defaultContainer.has(identifier);
  }

  static remove<T>(identifier: ServiceIdentifier<T>): typeof RuntimeContainer {
    defaultContainer.remove(identifier);
    return RuntimeContainer;
  }

  static reset(id?: string): typeof RuntimeContainer {
    if (id) {
      const container = containers.get(id);
      container?.reset();
      containers.delete(id);
      return RuntimeContainer;
    }
    defaultContainer.reset();
    return RuntimeContainer;
  }
}
