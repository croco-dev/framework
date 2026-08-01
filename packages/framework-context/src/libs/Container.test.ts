import { Token, Container as TypeDIContainer } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { Container } from "./Container";
import { Context } from "./Context";
import { Component } from "./decorators/Component";

describe("Container.getRequestScoped", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("should return same instance within Context.run()", () => {
    class MyService {
      public value = Math.random();
    }

    Component({ scope: "request" })(MyService);

    let instance1!: MyService;
    let instance2!: MyService;

    Context.run({ requestId: "test-1" }, () => {
      instance1 = Container.get(MyService);
      instance2 = Container.get(MyService);
    });

    expect(instance1).toBe(instance2);
  });

  it("should return different instances for different requests", () => {
    class MyService {
      public value = Math.random();
    }

    Component({ scope: "request" })(MyService);

    let instance1!: MyService;
    let instance2!: MyService;

    Context.run({ requestId: "req-1" }, () => {
      instance1 = Container.get(MyService);
    });

    Context.run({ requestId: "req-2" }, () => {
      instance2 = Container.get(MyService);
    });

    expect(instance1).not.toBe(instance2);
  });

  it("should fail fast when request-scoped service is resolved outside Context", () => {
    class MyService {
      public value = Math.random();
    }

    Component({ scope: "request" })(MyService);

    expect(() => Container.get(MyService)).toThrow(
      "Request-scoped dependencies must be resolved inside Context.run().",
    );
  });

  it("should continue returning the same instance within Context.run() for request-scoped services", () => {
    class MyService {
      public value = Math.random();
    }

    Component({ scope: "request" })(MyService);

    let instance1!: MyService;
    let instance2!: MyService;

    Context.run({ requestId: "req-outside-guard" }, () => {
      instance1 = Container.get(MyService);
      instance2 = Container.get(MyService);
    });

    expect(instance1).toBe(instance2);
  });

  it("should work with nested Context.run() calls", () => {
    class MyService {
      public value = Math.random();
    }

    Component({ scope: "request" })(MyService);

    let outerInstance!: MyService;
    let innerInstance!: MyService;

    Context.run({ requestId: "outer" }, () => {
      outerInstance = Container.get(MyService);

      Context.run({ requestId: "inner" }, () => {
        innerInstance = Container.get(MyService);
      });
    });

    expect(outerInstance).not.toBe(innerInstance);
  });

  it("should respect @Inject token metadata for transient services", () => {
    const configToken = new Token<string>("config.token");

    class ConfigConsumer {
      constructor(public readonly config: string) {}
    }

    Reflect.defineMetadata("design:paramtypes", [String], ConfigConsumer);
    TypeDIContainer.registerHandler({
      object: ConfigConsumer,
      index: 0,
      value: (container) => container.get(configToken),
    });
    Component({ scope: "transient" })(ConfigConsumer);
    Container.set(configToken, "token-value");

    const instance = Container.get(ConfigConsumer);

    expect(instance.config).toBe("token-value");
  });

  it("should resolve and cache singleton components through Croco dependency resolution", () => {
    class Dep {
      value = "ok";
    }

    class SingletonService {
      constructor(public readonly dep: Dep) {}
    }

    Reflect.defineMetadata("design:paramtypes", [], Dep);
    Reflect.defineMetadata("design:paramtypes", [Dep], SingletonService);
    Component()(Dep);
    Component()(SingletonService);

    const first = Container.get(SingletonService);
    const second = Container.get(SingletonService);

    expect(first.dep.value).toBe("ok");
    expect(first).toBe(second);
    expect(first.dep).toBe(second.dep);
  });

  it("should respect @Inject token metadata for request-scoped services", () => {
    const configToken = new Token<string>("request.config.token");

    class RequestConfigConsumer {
      constructor(public readonly config: string) {}
    }

    Reflect.defineMetadata("design:paramtypes", [String], RequestConfigConsumer);
    TypeDIContainer.registerHandler({
      object: RequestConfigConsumer,
      index: 0,
      value: (container) => container.get(configToken),
    });
    Component({ scope: "request" })(RequestConfigConsumer);
    Container.set(configToken, "request-token-value");

    let instance!: RequestConfigConsumer;
    Context.run({ requestId: "request-1" }, () => {
      instance = Container.get(RequestConfigConsumer);
    });

    expect(instance.config).toBe("request-token-value");
  });
});

describe("Container.toTypeDIServiceIdentifier", () => {
  beforeEach(() => Container.reset());

  it("returns non-symbol identifiers unchanged", () => {
    class Service {}
    const token = new Token<string>("config");

    expect(Container.toTypeDIServiceIdentifier(Service)).toBe(Service);
    expect(Container.toTypeDIServiceIdentifier(token)).toBe(token);
    expect(Container.toTypeDIServiceIdentifier("config")).toBe("config");
  });

  it("maps symbols to one TypeDI token until reset", () => {
    const symbol = Symbol("config");
    const first = Container.toTypeDIServiceIdentifier(symbol);

    expect(Container.toTypeDIServiceIdentifier(symbol)).toBe(first);
    Container.reset();
    expect(Container.toTypeDIServiceIdentifier(symbol)).not.toBe(first);
  });
});

describe("Container.reset", () => {
  it("removes explicitly registered class values", () => {
    class Service {}

    Container.set(Service, new Service());
    expect(Container.has(Service)).toBe(true);

    Container.reset();

    expect(Container.has(Service)).toBe(false);
  });
});

describe("ContainerScope", () => {
  beforeEach(() => Container.reset());

  it("isolates singleton values across concurrent asynchronous scopes", async () => {
    class ScopedService {
      constructor(readonly value: string) {}
    }

    const first = Container.createScope();
    const second = Container.createScope();
    const firstReady = Promise.withResolvers<void>();
    const secondReady = Promise.withResolvers<void>();

    const [firstValue, secondValue] = await Promise.all([
      first.run(async () => {
        Container.set(ScopedService, new ScopedService("first"));
        firstReady.resolve();
        await secondReady.promise;
        return Container.get(ScopedService);
      }),
      second.run(async () => {
        Container.set(ScopedService, new ScopedService("second"));
        secondReady.resolve();
        await firstReady.promise;
        return Container.get(ScopedService);
      }),
    ]);

    expect(firstValue.value).toBe("first");
    expect(secondValue.value).toBe("second");
    expect(firstValue).not.toBe(secondValue);
    expect(Container.has(ScopedService)).toBe(false);

    first.dispose();
    second.dispose();
  });

  it("isolates diagnostic identities and source locations across concurrent scopes", async () => {
    const createNamedService = () => class SharedService {};
    const firstServices = [createNamedService(), createNamedService()] as const;
    const secondServices = [createNamedService(), createNamedService()] as const;
    const firstReady = Promise.withResolvers<void>();
    const secondReady = Promise.withResolvers<void>();
    const first = Container.createScope();
    const second = Container.createScope();

    const [firstManifest, secondManifest] = await Promise.all([
      first.run(async () => {
        firstServices.forEach((service, index) => {
          Container.setComponentSourceLocation(service, {
            file: `first-${index + 1}.ts`,
            line: index + 1,
          });
          Component()(service);
        });
        firstReady.resolve();
        await secondReady.promise;
        return Container.createDependencyGraphManifest({ roots: firstServices });
      }),
      second.run(async () => {
        secondServices.forEach((service, index) => {
          Container.setComponentSourceLocation(service, {
            file: `second-${index + 1}.ts`,
            line: index + 1,
          });
          Component()(service);
        });
        secondReady.resolve();
        await firstReady.promise;
        return Container.createDependencyGraphManifest({ roots: secondServices });
      }),
    ]);

    expect(firstManifest.rootIds).toEqual([
      "constructor:SharedService",
      "constructor:SharedService#2",
    ]);
    expect(secondManifest.rootIds).toEqual(firstManifest.rootIds);
    expect(firstManifest.providers.map((provider) => provider.sourceLocation?.file)).toEqual([
      "first-1.ts",
      "first-2.ts",
    ]);
    expect(secondManifest.providers.map((provider) => provider.sourceLocation?.file)).toEqual([
      "second-1.ts",
      "second-2.ts",
    ]);

    first.dispose();
    second.dispose();
  });

  it("keeps reset local to the active scope", () => {
    const rootToken = new Token<string>("root");
    const scopedToken = new Token<string>("scoped");
    Container.set(rootToken, "root");
    const scope = Container.createScope();

    scope.run(() => {
      Container.set(scopedToken, "scoped");
      Container.reset();
      expect(Container.has(scopedToken)).toBe(false);
    });

    expect(Container.get(rootToken)).toBe("root");
    scope.dispose();
  });

  it("does not inherit root provider instances", () => {
    class RootService {}

    Container.set(RootService, new RootService());
    const scope = Container.createScope();

    scope.run(() => {
      expect(Container.has(RootService)).toBe(false);
      expect(() => Container.get(RootService)).toThrow("provider is not registered");
    });

    expect(Container.get(RootService)).toBeInstanceOf(RootService);
    scope.dispose();
  });

  it("rejects work after disposal and disposes idempotently", () => {
    const scope = Container.createScope();

    scope.dispose();
    scope.dispose();

    expect(() => scope.run(() => undefined)).toThrow("has already been disposed");
  });

  it("rejects container access from work that resumes after disposal", async () => {
    const scope = Container.createScope();
    const resume = Promise.withResolvers<void>();
    const operation = scope.run(async () => {
      await resume.promise;
      return Container.set("late-value", "late");
    });

    scope.dispose();
    resume.resolve();

    await expect(operation).rejects.toThrow("has already been disposed");
  });
});
