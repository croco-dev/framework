import { beforeEach, describe, expect, it } from "vitest";
import "reflect-metadata";
import { Container, Inject, MetadataStorage } from "../index";
import { CircularDependencyProblem } from "../libs/problems/CircularDependencyProblem";

describe("Container.validate", () => {
  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
  });

  it("should throw with full cycle path when circular dependency exists", () => {
    class ServiceA {
      constructor(_b: ServiceB) {}
    }

    class ServiceB {
      constructor(_c: ServiceC) {}
    }

    class ServiceC {
      constructor(_a: ServiceA) {}
    }

    Reflect.defineMetadata("design:paramtypes", [ServiceB], ServiceA);
    Reflect.defineMetadata("design:paramtypes", [ServiceC], ServiceB);
    Reflect.defineMetadata("design:paramtypes", [ServiceA], ServiceC);

    Container.register(ServiceA, "transient");
    Container.register(ServiceB, "transient");
    Container.register(ServiceC, "transient");

    expect(() => {
      Container.validate();
    }).toThrow(CircularDependencyProblem);

    expect(() => {
      Container.validate();
    }).toThrowError(/Circular dependency detected: ServiceA → ServiceB → ServiceC → ServiceA/);
  });

  it("should not throw when no circular dependency exists", () => {
    class ServiceA {}

    class ServiceB {
      constructor(_a: ServiceA) {}
    }

    class ServiceC {
      constructor(_b: ServiceB) {}
    }

    Reflect.defineMetadata("design:paramtypes", [], ServiceA);
    Reflect.defineMetadata("design:paramtypes", [ServiceA], ServiceB);
    Reflect.defineMetadata("design:paramtypes", [ServiceB], ServiceC);

    Container.register(ServiceA, "singleton");
    Container.register(ServiceB, "singleton");
    Container.register(ServiceC, "singleton");

    expect(() => {
      Container.validate();
    }).not.toThrow();
  });

  it("should detect self-referencing dependency", () => {
    class SelfReferencing {
      constructor(_self: SelfReferencing) {}
    }

    Reflect.defineMetadata("design:paramtypes", [SelfReferencing], SelfReferencing);
    Container.register(SelfReferencing, "transient");

    expect(() => {
      Container.validate();
    }).toThrow(CircularDependencyProblem);

    expect(() => {
      Container.validate();
    }).toThrowError(/Circular dependency detected: SelfReferencing → SelfReferencing/);
  });

  it("should detect explicit injected cycles beyond constructor arity", () => {
    class ServiceA {
      constructor(_dependency: unknown = undefined) {}
    }

    class ServiceB {
      constructor(_dependency: unknown = undefined) {}
    }

    Inject(() => ServiceB)(ServiceA, undefined, 0);
    Inject(() => ServiceA)(ServiceB, undefined, 0);

    Container.register(ServiceA, "transient");
    Container.register(ServiceB, "transient");

    expect(() => {
      Container.validate();
    }).toThrowError(/Circular dependency detected: ServiceA → ServiceB → ServiceA/);
  });

  it("should detect a cycle in a branched dependency graph", () => {
    class SharedDependency {}

    class ServiceA {
      constructor(_dependency: SharedDependency) {}
    }

    class ServiceB {
      constructor(_serviceC: ServiceC) {}
    }

    class ServiceC {
      constructor(_serviceD: ServiceD) {}
    }

    class ServiceD {
      constructor(_serviceB: ServiceB) {}
    }

    Reflect.defineMetadata("design:paramtypes", [], SharedDependency);
    Reflect.defineMetadata("design:paramtypes", [SharedDependency], ServiceA);
    Reflect.defineMetadata("design:paramtypes", [ServiceC], ServiceB);
    Reflect.defineMetadata("design:paramtypes", [ServiceD], ServiceC);
    Reflect.defineMetadata("design:paramtypes", [ServiceB], ServiceD);

    Container.register(SharedDependency, "singleton");
    Container.register(ServiceA, "singleton");
    Container.register(ServiceB, "singleton");
    Container.register(ServiceC, "singleton");
    Container.register(ServiceD, "singleton");

    expect(() => {
      Container.validate();
    }).toThrowError(/Circular dependency detected: ServiceB → ServiceC → ServiceD → ServiceB/);
  });

  it("should re-run validation after removing a dependency registration", () => {
    class Dependency {}

    class Consumer {
      constructor(_dependency: Dependency) {}
    }

    Reflect.defineMetadata("design:paramtypes", [], Dependency);
    Reflect.defineMetadata("design:paramtypes", [Dependency], Consumer);

    Container.register(Dependency, "singleton");
    Container.register(Consumer, "singleton");

    expect(() => {
      Container.validate();
    }).not.toThrow();

    Container.remove(Dependency);

    expect(() => {
      Container.get(Consumer);
      Container.validate();
    }).toThrow();
  });

  it("should re-run validation after setting a dependency registration", () => {
    class Dependency {}

    class Consumer {
      constructor(_dependency: Dependency) {}
    }

    Reflect.defineMetadata("design:paramtypes", [], Dependency);
    Reflect.defineMetadata("design:paramtypes", [Dependency], Consumer);

    Container.register(Dependency, "singleton");
    Container.register(Consumer, "singleton");

    expect(() => {
      Container.validate();
    }).not.toThrow();

    Container.remove(Dependency);
    Container.set(Dependency, new Dependency());

    expect(() => {
      Container.validate();
    }).not.toThrow();
  });
});
