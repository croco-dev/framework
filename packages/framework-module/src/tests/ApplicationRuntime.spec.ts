import { beforeEach, describe, expect, it } from "vitest";
import {
  Container as FrameworkContainer,
  GENERATED_DI_GRAPH_VERSION,
  Inject,
  Inject as CrocoInject,
  RuntimeContainer as Container,
  Token,
  defineGeneratedDiGraph,
} from "@croco/framework-context";
import type { ServiceMetadata } from "@croco/framework-context";
import {
  createApplicationRuntime,
  defineCrocoApplication,
  InvalidModuleDefinitionProblem,
  ModuleLifecycleCancelledProblem,
  ModuleLifecycleProblem,
  ModuleRuntimeDisposedProblem,
  ModuleRuntimeStaleContextProblem,
} from "../index";
import type { ModuleContext } from "../index";

describe("ApplicationRuntime", () => {
  beforeEach(() => {
    Container.reset();
    FrameworkContainer.reset();
  });

  it("isolates generated singleton instances and disposes them with each runtime", async () => {
    let disposals = 0;
    class GeneratedService {
      [Symbol.dispose](): void {
        disposals += 1;
      }
    }
    const generatedGraph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "application-runtime-test",
      compilerVersion: "test",
      inputHash: "test-input",
      roots: [GeneratedService],
      providers: [
        {
          token: GeneratedService,
          tokenId: "app:GeneratedService",
          debugName: "GeneratedService",
          scope: "singleton",
          dependencies: [],
          factory: () => new GeneratedService(),
          sourceLocation: { file: "src/GeneratedService.ts", line: 1, column: 1 },
        },
      ],
    });
    const first = createApplicationRuntime({ generatedGraph });
    const second = createApplicationRuntime({ generatedGraph });

    const firstService = first.get(GeneratedService);
    expect(first.get(GeneratedService)).toBe(firstService);
    expect(second.get(GeneratedService)).not.toBe(firstService);

    await Promise.all([first.dispose(), second.dispose()]);
    expect(disposals).toBe(2);
  });

  it("uses generated factories for classes declared by an application module", async () => {
    class Dependency {}
    class Service {
      constructor(readonly dependency: Dependency) {}
    }
    let callbackCalls = 0;
    Inject(() => {
      callbackCalls += 1;
      return Dependency;
    })(Service, undefined, 0);
    const SERVICE_ALIAS = new Token<Service>("service.alias");
    let serviceFromModule: Service | undefined;
    const generatedGraph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "module-class-factory",
      compilerVersion: "test",
      inputHash: "module-class-factory",
      roots: [Service],
      providers: [
        {
          token: Dependency,
          tokenId: "app:Dependency",
          debugName: "Dependency",
          scope: "singleton",
          dependencies: [],
          factory: () => new Dependency(),
          sourceLocation: { file: "src/Dependency.ts", line: 1, column: 1 },
        },
        {
          token: Service,
          tokenId: "app:Service",
          debugName: "Service",
          scope: "singleton",
          dependencies: [{ token: Dependency, tokenId: "app:Dependency", parameterIndex: 0 }],
          factory: (resolver) => new Service(resolver.get(Dependency)),
          sourceLocation: { file: "src/Service.ts", line: 1, column: 1 },
        },
      ],
    });
    const runtime = createApplicationRuntime({
      generatedGraph,
      modules: [
        {
          name: "app",
          providers: [Dependency, Service, { provide: SERVICE_ALIAS, useClass: Service }],
          setup: (context) => {
            serviceFromModule = context.get(Service);
            expect(context.get(SERVICE_ALIAS)).toBe(serviceFromModule);
          },
        },
      ],
    });

    expect(runtime.createGraphManifest().status).toBe("ready");
    expect(callbackCalls).toBe(0);
    await runtime.initialize();
    expect(runtime.get(Service).dependency).toBe(runtime.get(Dependency));
    expect(runtime.get(Service)).toBe(serviceFromModule);
    expect(runtime.get(SERVICE_ALIAS)).toBe(serviceFromModule);
    expect(runtime.createGraphManifest().status).toBe("ready");
    expect(callbackCalls).toBe(0);
    await runtime.dispose();
  });

  it("rejects uncompiled class providers without evaluating injection callbacks", async () => {
    class Dependency {}
    let callbackCalls = 0;
    class Service {
      constructor(
        @Inject(() => {
          callbackCalls += 1;
          return Dependency;
        })
        readonly dependency: Dependency,
      ) {}
    }

    for (const provider of [
      Service,
      { provide: new Token<Service>("service"), useClass: Service },
    ]) {
      const runtime = createApplicationRuntime({
        modules: [{ name: "app", providers: [Dependency, provider] }],
      });

      await expect(runtime.initialize()).rejects.toMatchObject({
        cause: expect.any(InvalidModuleDefinitionProblem),
      });
      expect(callbackCalls).toBe(0);
      await runtime.dispose();
    }
  });

  it("uses a generated factory or explicit module factory without evaluating injection callbacks", async () => {
    class Dependency {}
    let callbackCalls = 0;
    class Service {
      constructor(
        @Inject(() => {
          callbackCalls += 1;
          return Dependency;
        })
        readonly dependency: Dependency,
      ) {}
    }
    const generatedGraph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "compiled-injection-callback",
      compilerVersion: "test",
      inputHash: "compiled-injection-callback",
      roots: [Service],
      providers: [
        {
          token: Service,
          tokenId: "app:Service",
          debugName: "Service",
          scope: "singleton",
          dependencies: [],
          factory: () => new Service(new Dependency()),
          sourceLocation: { file: "src/Service.ts", line: 1, column: 1 },
        },
      ],
    });
    const compiled = createApplicationRuntime({
      generatedGraph,
      modules: [{ name: "compiled", providers: [Service] }],
    });
    await compiled.initialize();
    expect(compiled.get(Service).dependency).toBeInstanceOf(Dependency);
    await compiled.dispose();

    const explicit = createApplicationRuntime({
      modules: [
        {
          name: "explicit",
          providers: [
            Dependency,
            { provide: Service, useFactory: (context) => new Service(context.get(Dependency)) },
          ],
        },
      ],
    });
    await explicit.initialize();
    expect(explicit.get(Service).dependency).toBeInstanceOf(Dependency);
    expect(callbackCalls).toBe(0);
    await explicit.dispose();
  });

  it("resolves declared module providers from each application and rejects missing owners", async () => {
    const valueToken = new Token<string>("module-value");
    class GeneratedService {
      constructor(readonly value: string) {}
    }
    const generatedGraph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "module-provider-bridge",
      compilerVersion: "test",
      inputHash: "module-provider-bridge",
      moduleProviders: [
        {
          token: valueToken,
          tokenId: "app:tokens#VALUE",
          moduleName: "app",
          scope: "singleton",
          sourceLocation: { file: "src/tokens.ts", line: 1, column: 1 },
        },
      ],
      providers: [
        {
          token: GeneratedService,
          tokenId: "app:GeneratedService",
          debugName: "GeneratedService",
          scope: "singleton",
          dependencies: [{ token: valueToken, tokenId: "app:tokens#VALUE", parameterIndex: 0 }],
          factory: (resolver) => new GeneratedService(resolver.get(valueToken)),
          sourceLocation: { file: "src/GeneratedService.ts", line: 1, column: 1 },
        },
      ],
      roots: [GeneratedService],
    });
    const first = createApplicationRuntime({
      generatedGraph,
      modules: [
        {
          name: "app",
          providers: [{ provide: valueToken, useValue: "first" }],
          exports: [valueToken],
        },
      ],
    });
    const second = createApplicationRuntime({
      generatedGraph,
      modules: [
        {
          name: "app",
          providers: [{ provide: valueToken, useValue: "second" }],
          exports: [valueToken],
        },
      ],
    });
    const invalid = createApplicationRuntime({
      generatedGraph,
      modules: [{ name: "app", providers: [GeneratedService] }],
    });

    await Promise.all([first.initialize(), second.initialize()]);
    expect(first.get(GeneratedService).value).toBe("first");
    expect(second.get(GeneratedService).value).toBe("second");
    await expect(invalid.initialize()).rejects.toThrow("app:tokens#VALUE");
    await Promise.all([first.dispose(), second.dispose(), invalid.dispose()]);
  });

  it.each(["request", "transient"] as const)(
    "rejects a singleton module alias to a generated %s provider before setup",
    async (scope) => {
      class ScopedService {}
      const alias = new Token<ScopedService>("module.scoped-alias");
      let setupCalled = false;
      const generatedGraph = defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: `module-${scope}-alias`,
        compilerVersion: "test",
        inputHash: `module-${scope}-alias`,
        moduleProviders: [
          {
            token: alias,
            tokenId: "app:SCOPED_ALIAS",
            moduleName: "app",
            scope: "singleton",
            sourceLocation: { file: "src/app.ts", line: 1, column: 1 },
          },
        ],
        providers: [
          {
            token: ScopedService,
            tokenId: "app:ScopedService",
            debugName: "ScopedService",
            scope,
            dependencies: [],
            factory: () => new ScopedService(),
            sourceLocation: { file: "src/ScopedService.ts", line: 1, column: 1 },
          },
        ],
        roots: [],
      });
      const runtime = createApplicationRuntime({
        generatedGraph,
        modules: [
          {
            name: "app",
            providers: [{ provide: alias, useClass: ScopedService }],
            setup: () => {
              setupCalled = true;
            },
          },
        ],
      });

      await expect(runtime.initialize()).rejects.toThrow(InvalidModuleDefinitionProblem);
      await expect(runtime.initialize()).rejects.toThrow(
        `cannot use ${scope} provider 'app:ScopedService' as a singleton`,
      );
      expect(setupCalled).toBe(false);
      await runtime.dispose();
    },
  );

  it("validates the effective application replacement for a generated module provider", async () => {
    class ScopedService {}
    const alias = new Token<ScopedService>("module.replaced-alias");
    let setupCalled = false;
    const generatedGraph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "module-replaced-alias",
      compilerVersion: "test",
      inputHash: "module-replaced-alias",
      moduleProviders: [
        {
          token: alias,
          tokenId: "app:REPLACED_ALIAS",
          moduleName: "app",
          scope: "singleton",
          sourceLocation: { file: "src/app.ts", line: 1, column: 1 },
        },
      ],
      providers: [
        {
          token: ScopedService,
          tokenId: "app:ScopedService",
          debugName: "ScopedService",
          scope: "request",
          dependencies: [],
          factory: () => new ScopedService(),
          sourceLocation: { file: "src/ScopedService.ts", line: 1, column: 1 },
        },
      ],
      roots: [],
    });
    const application = defineCrocoApplication({
      imports: [
        {
          name: "app",
          providers: [{ provide: alias, useValue: new ScopedService() }],
          setup: () => {
            setupCalled = true;
          },
        },
      ],
      providerReplacements: [
        {
          provider: { provide: alias, useClass: ScopedService },
          replaces: ["app"],
        },
      ],
    });
    const runtime = createApplicationRuntime(application, generatedGraph);

    await expect(runtime.initialize()).rejects.toThrow(
      "cannot use request provider 'app:ScopedService' as a singleton",
    );
    expect(setupCalled).toBe(false);
    await runtime.dispose();
  });

  it("applies a module override only to its generated application graph", async () => {
    class GeneratedService {
      constructor(readonly value: string) {}
    }
    const generatedGraph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "application-runtime-override-test",
      compilerVersion: "test",
      inputHash: "test-input",
      roots: [GeneratedService],
      providers: [
        {
          token: GeneratedService,
          tokenId: "app:GeneratedService",
          debugName: "GeneratedService",
          scope: "singleton",
          dependencies: [],
          factory: () => new GeneratedService("generated"),
          sourceLocation: { file: "src/GeneratedService.ts", line: 1, column: 1 },
        },
      ],
    });
    const overridden = createApplicationRuntime({
      generatedGraph,
      modules: [
        {
          name: "test-override",
          providers: [{ provide: GeneratedService, useValue: new GeneratedService("override") }],
        },
      ],
    });
    const untouched = createApplicationRuntime({ generatedGraph });

    await Promise.all([overridden.initialize(), untouched.initialize()]);
    expect(overridden.get(GeneratedService).value).toBe("override");
    expect(untouched.get(GeneratedService).value).toBe("generated");
    await Promise.all([overridden.dispose(), untouched.dispose()]);
  });

  it("cleans generated singletons created by a failed initialization attempt", async () => {
    let attempts = 0;
    let disposals = 0;
    class GeneratedService {
      [Symbol.dispose](): void {
        disposals += 1;
      }
    }
    const generatedGraph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "application-runtime-rollback-test",
      compilerVersion: "test",
      inputHash: "test-input",
      roots: [GeneratedService],
      providers: [
        {
          token: GeneratedService,
          tokenId: "app:GeneratedService",
          debugName: "GeneratedService",
          scope: "singleton",
          dependencies: [],
          factory: () => new GeneratedService(),
          sourceLocation: { file: "src/GeneratedService.ts", line: 1, column: 1 },
        },
      ],
    });
    const runtime = createApplicationRuntime({
      generatedGraph,
      modules: [
        {
          name: "failing-bootstrap",
          setup: () => {
            attempts += 1;
            FrameworkContainer.get(GeneratedService);
            if (attempts === 1) {
              throw new Error("bootstrap failed");
            }
          },
        },
      ],
    });

    await expect(runtime.initialize()).rejects.toThrow("bootstrap failed");
    expect(disposals).toBe(1);
    await runtime.initialize();
    expect(runtime.get(GeneratedService)).toBeInstanceOf(GeneratedService);
    await runtime.dispose();
    expect(disposals).toBe(2);
  });

  it("isolates identical module names and provider tokens across runtimes", async () => {
    const token = new Token<string>("runtime-value");
    const first = createApplicationRuntime({
      modules: [{ name: "app", providers: [{ provide: token, useValue: "first" }] }],
    });
    const second = createApplicationRuntime({
      modules: [{ name: "app", providers: [{ provide: token, useValue: "second" }] }],
    });

    await Promise.all([first.initialize(), second.initialize()]);

    expect(first.get(token)).toBe("first");
    expect(second.get(token)).toBe("second");
    first.run(() => FrameworkContainer.set(token, "first-updated"));
    expect(first.get(token)).toBe("first-updated");
    expect(second.get(token)).toBe("second");

    await Promise.all([first.dispose(), second.dispose()]);
  });

  it("does not allocate a runtime scope when constructor module validation fails", () => {
    const instancesBefore = [
      ...(Container as unknown as { instances: readonly { id: string }[] }).instances,
    ];

    expect(() => createApplicationRuntime({ modules: [{ name: "invalid" }] })).toThrow(
      "must define metadata or lifecycle hooks",
    );

    expect((Container as unknown as { instances: readonly { id: string }[] }).instances).toEqual(
      instancesBefore,
    );
  });

  it("preserves scoped symbol and class providers across an unrelated root reset", async () => {
    const symbolToken = Symbol("runtime-symbol");
    class RuntimeService {}
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [RuntimeService, { provide: symbolToken, useValue: "scoped" }],
        },
      ],
    });
    await runtime.initialize();
    const service = runtime.get(RuntimeService);

    FrameworkContainer.set("root-value", "root");
    FrameworkContainer.reset();

    expect(runtime.get(symbolToken)).toBe("scoped");
    expect(runtime.get(RuntimeService)).toBe(service);
    expect(FrameworkContainer.has("root-value")).toBe(false);

    await runtime.dispose();
  });

  it("runs every lifecycle phase and re-entered callback in the owning scope", async () => {
    const observedScopeIds: Array<string | undefined> = [];
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          setup: () => {
            observedScopeIds.push(FrameworkContainer.getActiveScopeId());
          },
          start: () => {
            observedScopeIds.push(FrameworkContainer.getActiveScopeId());
          },
          shutdown: () => {
            observedScopeIds.push(FrameworkContainer.getActiveScopeId());
          },
        },
      ],
    });

    await runtime.initialize();
    await Promise.resolve().then(() =>
      runtime.run(() => {
        observedScopeIds.push(FrameworkContainer.getActiveScopeId());
      }),
    );
    await runtime.dispose();

    expect(observedScopeIds).toEqual([
      runtime.scopeId,
      runtime.scopeId,
      runtime.scopeId,
      runtime.scopeId,
    ]);
  });

  it("binds host callbacks to the owning scope and fences them after disposal", async () => {
    const runtime = createApplicationRuntime();
    const callback = runtime.bindHostCallback(() => FrameworkContainer.getActiveScopeId());

    expect(callback()).toBe(runtime.scopeId);

    await runtime.dispose();

    expect(() => callback()).toThrow("has already been disposed");
  });

  it("propagates initialization cancellation through the application-owned lifecycle", async () => {
    const controller = new AbortController();
    let observedDeadline: number | undefined;
    let setupStarted: (() => void) | undefined;
    const setupEntered = new Promise<void>((resolve) => {
      setupStarted = resolve;
    });
    const deadline = Date.now() + 10_000;
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          setup: async (_moduleContext, execution) => {
            observedDeadline = execution.deadline;
            setupStarted?.();
            await new Promise<void>((resolve) => {
              execution.signal.addEventListener("abort", () => resolve(), { once: true });
            });
          },
        },
      ],
    });

    const initialization = runtime.initialize({ signal: controller.signal, deadline });
    await setupEntered;
    controller.abort();

    await expect(initialization).rejects.toBeInstanceOf(ModuleLifecycleCancelledProblem);
    expect(observedDeadline).toBe(deadline);
    await runtime.dispose();
  });

  it("propagates shutdown cancellation through the application-owned lifecycle", async () => {
    const controller = new AbortController();
    let observedDeadline: number | undefined;
    let shutdownStarted: (() => void) | undefined;
    const shutdownEntered = new Promise<void>((resolve) => {
      shutdownStarted = resolve;
    });
    const deadline = Date.now() + 10_000;
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          setup: () => undefined,
          shutdown: async (_moduleContext, execution) => {
            observedDeadline = execution.deadline;
            shutdownStarted?.();
            await new Promise<void>((resolve) => {
              execution.signal.addEventListener("abort", () => resolve(), { once: true });
            });
          },
        },
      ],
    });
    await runtime.initialize();

    const shutdown = runtime.shutdown({ signal: controller.signal, deadline });
    await shutdownEntered;
    controller.abort();

    await expect(shutdown).rejects.toBeInstanceOf(ModuleLifecycleCancelledProblem);
    expect(observedDeadline).toBe(deadline);
    await runtime.dispose();
  });

  it("compensates failed startup, clears scope state, and permits a clean retry", async () => {
    const leakedToken = new Token<string>("startup-leak");
    const providerToken = new Token<string>("module-provider");
    const seedToken = new Token<string>("startup-seed");
    let attempts = 0;
    let shutdowns = 0;
    let failedContext: ModuleContext | undefined;
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [{ provide: providerToken, useValue: "provider" }],
          setup: (context) => {
            attempts += 1;
            failedContext ??= context;
            FrameworkContainer.set(leakedToken, `attempt-${attempts}`);
            if (attempts === 1) {
              throw new Error("startup failed");
            }
          },
          shutdown: () => {
            shutdowns += 1;
          },
        },
      ],
    });
    runtime.run(() => FrameworkContainer.set(seedToken, "preserved"));

    await expect(runtime.initialize()).rejects.toBeInstanceOf(ModuleLifecycleProblem);
    expect(runtime.get(seedToken)).toBe("preserved");
    expect(runtime.has(leakedToken)).toBe(false);
    expect(runtime.has(providerToken)).toBe(false);
    expect(() => failedContext?.get(providerToken)).toThrow(ModuleRuntimeStaleContextProblem);

    await runtime.initialize();
    expect(() => failedContext?.get(providerToken)).toThrow(ModuleRuntimeStaleContextProblem);
    expect(runtime.get(leakedToken)).toBe("attempt-2");
    expect(runtime.get(providerToken)).toBe("provider");
    expect(shutdowns).toBe(1);

    await runtime.dispose();
    expect(shutdowns).toBe(2);
  });

  it("shares one rollback boundary across concurrent initialization callers", async () => {
    const leakedToken = new Token<string>("concurrent-startup-leak");
    let enterSetup: (() => void) | undefined;
    let releaseSetup: (() => void) | undefined;
    const setupEntered = new Promise<void>((resolve) => {
      enterSetup = resolve;
    });
    const setupReleased = new Promise<void>((resolve) => {
      releaseSetup = resolve;
    });
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          setup: async () => {
            FrameworkContainer.set(leakedToken, "attempt");
            enterSetup?.();
            await setupReleased;
            throw new Error("startup failed");
          },
        },
      ],
    });

    const first = runtime.initialize();
    await setupEntered;
    const second = runtime.initialize();

    expect(second).toBe(first);
    releaseSetup?.();
    await expect(first).rejects.toBeInstanceOf(ModuleLifecycleProblem);
    await expect(second).rejects.toBeInstanceOf(ModuleLifecycleProblem);
    expect(runtime.has(leakedToken)).toBe(false);

    await runtime.dispose();
  });

  it("does not expose a successful initialization or providers after shutdown starts", async () => {
    const token = new Token<string>("shutdown-race-provider");
    let enterSetup: (() => void) | undefined;
    let releaseSetup: (() => void) | undefined;
    let setupAttempts = 0;
    const setupEntered = new Promise<void>((resolve) => {
      enterSetup = resolve;
    });
    const setupReleased = new Promise<void>((resolve) => {
      releaseSetup = resolve;
    });
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [{ provide: token, useValue: "available" }],
          setup: async () => {
            setupAttempts += 1;
            if (setupAttempts === 1) {
              enterSetup?.();
              await setupReleased;
            }
          },
        },
      ],
    });

    const initialization = runtime.initialize();
    await setupEntered;
    const shutdown = runtime.shutdown();

    expect(() => runtime.get(token)).toThrow(ModuleRuntimeStaleContextProblem);
    releaseSetup?.();
    await expect(initialization).rejects.toBeInstanceOf(ModuleRuntimeStaleContextProblem);
    await expect(shutdown).resolves.toBeUndefined();
    expect(() => runtime.get(token)).toThrow(ModuleRuntimeStaleContextProblem);

    await runtime.initialize();
    expect(runtime.get(token)).toBe("available");
    await runtime.dispose();
  });

  it("does not expose a successful initialization or providers after disposal starts", async () => {
    const token = new Token<string>("disposal-race-provider");
    let enterSetup: (() => void) | undefined;
    let releaseSetup: (() => void) | undefined;
    const setupEntered = new Promise<void>((resolve) => {
      enterSetup = resolve;
    });
    const setupReleased = new Promise<void>((resolve) => {
      releaseSetup = resolve;
    });
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [{ provide: token, useValue: "available" }],
          setup: async () => {
            enterSetup?.();
            await setupReleased;
          },
        },
      ],
    });

    const initialization = runtime.initialize();
    await setupEntered;
    const disposal = runtime.dispose();

    expect(() => runtime.get(token)).toThrow(ModuleRuntimeDisposedProblem);
    releaseSetup?.();
    await expect(initialization).rejects.toBeInstanceOf(ModuleRuntimeDisposedProblem);
    await expect(disposal).resolves.toBeUndefined();
    expect(() => runtime.get(token)).toThrow("has already been disposed");
  });

  it("rejects shutdown cleanup that arrives while disposal is in progress", async () => {
    let enterShutdown: (() => void) | undefined;
    let releaseShutdown: (() => void) | undefined;
    const shutdownEntered = new Promise<void>((resolve) => {
      enterShutdown = resolve;
    });
    const shutdownReleased = new Promise<void>((resolve) => {
      releaseShutdown = resolve;
    });
    let cleanupCalls = 0;
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          setup: () => undefined,
          shutdown: async () => {
            enterShutdown?.();
            await shutdownReleased;
          },
        },
      ],
    });
    await runtime.initialize();

    const disposal = runtime.dispose();
    await shutdownEntered;
    const cleanup = runtime.shutdownWithCleanup(() => {
      cleanupCalls += 1;
    });

    await expect(cleanup).rejects.toBeInstanceOf(ModuleRuntimeDisposedProblem);
    expect(cleanupCalls).toBe(0);
    releaseShutdown?.();
    await expect(disposal).resolves.toBeUndefined();
  });

  it("rejects shutdown cleanup after disposal has completed", async () => {
    let cleanupCalls = 0;
    const runtime = createApplicationRuntime({
      modules: [{ name: "app", setup: () => undefined }],
    });
    await runtime.initialize();
    await runtime.dispose();

    await expect(
      runtime.shutdownWithCleanup(() => {
        cleanupCalls += 1;
      }),
    ).rejects.toBeInstanceOf(ModuleRuntimeDisposedProblem);
    expect(cleanupCalls).toBe(0);
  });

  it("waits for cleanup appended to an active shutdown before disposing the scope", async () => {
    const token = new Token<string>("active-shutdown-cleanup");
    let enterShutdown: (() => void) | undefined;
    let releaseShutdown: (() => void) | undefined;
    let enterCleanup: (() => void) | undefined;
    let releaseCleanup: (() => void) | undefined;
    const shutdownEntered = new Promise<void>((resolve) => {
      enterShutdown = resolve;
    });
    const shutdownReleased = new Promise<void>((resolve) => {
      releaseShutdown = resolve;
    });
    const cleanupEntered = new Promise<void>((resolve) => {
      enterCleanup = resolve;
    });
    const cleanupReleased = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [{ provide: token, useValue: "available" }],
          setup: () => undefined,
          shutdown: async () => {
            enterShutdown?.();
            await shutdownReleased;
          },
        },
      ],
    });
    await runtime.initialize();

    const shutdown = runtime.shutdown();
    await shutdownEntered;
    const cleanup = runtime.shutdownWithCleanup(async () => {
      enterCleanup?.();
      expect(FrameworkContainer.get(token)).toBe("available");
      await cleanupReleased;
      expect(FrameworkContainer.get(token)).toBe("available");
    });
    releaseShutdown?.();
    await cleanupEntered;
    await expect(shutdown).resolves.toBeUndefined();

    let disposalSettled = false;
    const disposal = runtime.dispose();
    void disposal.then(
      () => {
        disposalSettled = true;
      },
      () => {
        disposalSettled = true;
      },
    );
    await Promise.resolve();
    expect(disposalSettled).toBe(false);

    releaseCleanup?.();
    await expect(cleanup).resolves.toBeUndefined();
    await expect(disposal).resolves.toBeUndefined();
  });

  it("waits for cleanup accepted after shutdown before disposing the scope", async () => {
    const token = new Token<string>("stopped-shutdown-cleanup");
    let enterCleanup: (() => void) | undefined;
    let releaseCleanup: (() => void) | undefined;
    const cleanupEntered = new Promise<void>((resolve) => {
      enterCleanup = resolve;
    });
    const cleanupReleased = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [{ provide: token, useValue: "available" }],
          setup: () => undefined,
        },
      ],
    });
    await runtime.initialize();
    await runtime.shutdown();

    const cleanup = runtime.shutdownWithCleanup(async () => {
      enterCleanup?.();
      expect(FrameworkContainer.get(token)).toBe("available");
      await cleanupReleased;
      expect(FrameworkContainer.get(token)).toBe("available");
    });
    await cleanupEntered;

    let disposalSettled = false;
    const disposal = runtime.dispose();
    void disposal.then(
      () => {
        disposalSettled = true;
      },
      () => {
        disposalSettled = true;
      },
    );
    await Promise.resolve();
    expect(disposalSettled).toBe(false);

    releaseCleanup?.();
    await expect(cleanup).resolves.toBeUndefined();
    await expect(disposal).resolves.toBeUndefined();
  });

  it("shuts modules down before disposing the application scope", async () => {
    const token = new Token<string>("shutdown-value");
    const calls: string[] = [];
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [{ provide: token, useValue: "available" }],
          shutdown: () => {
            calls.push(`${FrameworkContainer.getActiveScopeId()}:${FrameworkContainer.get(token)}`);
          },
        },
      ],
    });

    await runtime.initialize();
    await runtime.dispose();

    expect(calls).toEqual([`${runtime.scopeId}:available`]);
    expect(() => runtime.run(() => undefined)).toThrow("has already been disposed");
  });

  it("emits deterministic module and DI graphs from the same runtime", async () => {
    const token = new Token<string>("graph-value");
    const runtime = createApplicationRuntime({
      modules: [{ name: "app", providers: [{ provide: token, useValue: "value" }] }],
    });
    await runtime.initialize();

    class UnrelatedGlobalComponent {}
    FrameworkContainer.register(UnrelatedGlobalComponent, "singleton");

    const first = runtime.createGraphManifest();
    const second = runtime.createGraphManifest();

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      version: "croco.application-runtime.graph.v1",
      status: "ready",
      moduleGraph: {
        status: "ready",
        modules: [{ name: "app", providers: [{ token: "graph-value" }] }],
      },
      dependencyGraph: {
        status: "ready",
        roots: ["Token<graph-value>"],
      },
    });
    expect(first.dependencyGraph.roots).not.toContain("UnrelatedGlobalComponent");

    await runtime.dispose();
  });

  it("recognizes value and factory providers before initialization without executing factories", async () => {
    const valueToken = new Token<string>("pre-initialize-value");
    const factoryToken = new Token<string>("pre-initialize-factory");
    let factoryCalls = 0;
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [
            { provide: valueToken, useValue: "value" },
            {
              provide: factoryToken,
              useFactory: () => {
                factoryCalls += 1;
                return "factory";
              },
            },
          ],
        },
      ],
    });

    const manifest = runtime.createGraphManifest();

    expect(manifest.status).toBe("ready");
    expect(manifest.dependencyGraph.diagnostics).toEqual([]);
    expect(manifest.dependencyGraph.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ token: "Token<pre-initialize-value>", dependencies: [] }),
        expect.objectContaining({ token: "Token<pre-initialize-factory>", dependencies: [] }),
      ]),
    );
    expect(factoryCalls).toBe(0);

    await runtime.dispose();
  });

  it("emits declarative constructor edges before initialization", async () => {
    class Repository {}
    const repositoryToken = new Token<Repository>("repository");
    const configToken = new Token<string>("config");
    class Service {
      constructor(
        @CrocoInject(repositoryToken) readonly repository: Repository,
        @CrocoInject(configToken) readonly config: string,
      ) {}
    }
    const serviceToken = new Token<Service>("service");
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [
            { provide: repositoryToken, useClass: Repository },
            Service,
            { provide: configToken, useValue: "configured" },
            { provide: serviceToken, useClass: Service },
          ],
        },
      ],
    });
    const manifest = runtime.createGraphManifest();
    const serviceProviders = manifest.dependencyGraph.providers.filter(
      (provider) => provider.token === "Service" || provider.token === "Token<service>",
    );

    expect(manifest.status).toBe("ready");
    expect(serviceProviders).toHaveLength(2);
    expect(serviceProviders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dependencies: ["Token<config>", "Token<repository>"] }),
        expect.objectContaining({ dependencies: ["Token<config>", "Token<repository>"] }),
      ]),
    );

    await runtime.dispose();
  });

  it("reports missing and circular dependencies without runtime fallback", async () => {
    class MissingDependency {}
    const missingToken = new Token<MissingDependency>("missing");
    class MissingConsumer {
      constructor(@Inject(missingToken) readonly dependency: MissingDependency) {}
    }
    const leftToken = new Token<CircularLeft>("circular-left");
    const rightToken = new Token<CircularRight>("circular-right");
    class CircularLeft {
      constructor(@Inject(rightToken) readonly right: CircularRight) {}
    }
    class CircularRight {
      constructor(@Inject(leftToken) readonly left: CircularLeft) {}
    }
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [
            MissingConsumer,
            { provide: leftToken, useClass: CircularLeft },
            { provide: rightToken, useClass: CircularRight },
          ],
        },
      ],
    });

    const manifest = runtime.createGraphManifest();

    expect(manifest.status).toBe("failed");
    expect(manifest.dependencyGraph.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "CROCO_DI_001" }),
        expect.objectContaining({ code: "CROCO_DI_002" }),
      ]),
    );

    await runtime.dispose();
  });

  it("reports uninspectable runtime handlers without throwing from graph creation", async () => {
    class Dependency {}
    class Service {
      constructor(readonly dependency: Dependency) {}
    }

    Reflect.defineMetadata("design:paramtypes", [Dependency], Service);
    Inject(() => {
      throw new Error("handler runtime failure");
    })(Service, undefined, 0);

    const runtime = createApplicationRuntime({
      modules: [{ name: "app", providers: [Dependency, Service] }],
    });

    const manifest = runtime.createGraphManifest();

    expect(manifest.status).toBe("failed");
    expect(manifest.moduleGraph.diagnostics).toContainEqual(
      expect.objectContaining({ code: "framework-module/provider-injection-uninspectable" }),
    );
    expect(manifest.dependencyGraph.diagnostics).toContainEqual(
      expect.objectContaining({ code: "CROCO_DI_005", token: "Service" }),
    );

    await runtime.dispose();
  });

  it("replays the same shutdown failure for repeated disposal", async () => {
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          shutdown: () => {
            throw new Error("shutdown failed");
          },
        },
      ],
    });
    await runtime.initialize();

    await expect(runtime.dispose()).rejects.toBeInstanceOf(ModuleLifecycleProblem);
    await expect(runtime.dispose()).rejects.toBeInstanceOf(ModuleLifecycleProblem);
  });

  it("becomes terminal when startup compensation fails", async () => {
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          setup: () => {
            throw new Error("startup failed");
          },
          shutdown: () => {
            throw new Error("compensation failed");
          },
        },
      ],
    });

    await expect(runtime.initialize()).rejects.toMatchObject({
      extensions: { cleanupFailures: [expect.objectContaining({ moduleName: "app" })] },
    });
    expect(() => runtime.run(() => undefined)).toThrow("has already been disposed");
  });

  it("releases its runtime scope after persistent rollback and disposal cleanup failures", async () => {
    const token = new Token<object>("failing-provider-cleanup");
    const baseline = {};
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [{ provide: token, useValue: {} }],
          setup: () => {
            throw new Error("startup failed");
          },
        },
      ],
    });
    runtime.run(() => FrameworkContainer.set(token, baseline));
    const container = Container.of(runtime.scopeId) as unknown as {
      destroyServiceInstance: (service: ServiceMetadata<unknown>) => void;
    };
    container.destroyServiceInstance = (service) => {
      if (service.id === token) {
        throw new Error("provider cleanup failed");
      }
    };

    await expect(runtime.initialize()).rejects.toMatchObject({
      code: "framework-module/lifecycle-failed",
      extensions: {
        cleanupFailures: expect.arrayContaining([
          expect.objectContaining({ moduleName: "<registry>" }),
          expect.objectContaining({ moduleName: "<application-runtime>" }),
        ]),
      },
    });
    expect(() => runtime.run(() => undefined)).toThrow("has already been disposed");
    await expect(runtime.initialize()).rejects.toThrow("has already been disposed");
    const typeDIRegistry = Container as unknown as {
      instances: readonly { readonly id: string }[];
    };
    expect(typeDIRegistry.instances.some((instance) => instance.id === runtime.scopeId)).toBe(
      false,
    );
  });

  it("preserves module shutdown failure when provider cleanup also fails", async () => {
    const token = new Token<object>("shutdown-provider-cleanup");
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [{ provide: token, useValue: {} }],
          shutdown: () => {
            throw new Error("module shutdown failed");
          },
        },
      ],
    });
    await runtime.initialize();
    const container = Container.of(runtime.scopeId) as unknown as {
      destroyServiceInstance: (service: ServiceMetadata<unknown>) => void;
    };
    container.destroyServiceInstance = (service) => {
      if (service.id === token) {
        throw new Error("provider cleanup failed");
      }
    };

    await expect(runtime.dispose()).rejects.toMatchObject({
      code: "framework-module/lifecycle-failed",
      message: expect.stringContaining("module shutdown failed"),
      extensions: {
        cleanupFailures: expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining("provider cleanup failed") }),
        ]),
      },
    });
  });

  it("preserves a non-lifecycle shutdown failure when provider cleanup also fails", async () => {
    const runtime = createApplicationRuntime({
      modules: [{ name: "app", setup: () => undefined }],
    });
    await runtime.initialize();
    const moduleRuntimeState = (
      runtime as unknown as {
        moduleRuntime: {
          state: {
            shutdownPromise: Promise<void> | null;
            container: { reset: () => void };
          };
        };
      }
    ).moduleRuntime.state;
    moduleRuntimeState.shutdownPromise = Promise.reject(new ModuleRuntimeStaleContextProblem());
    moduleRuntimeState.container.reset = () => {
      throw new Error("provider cleanup failed");
    };

    await expect(runtime.dispose()).rejects.toMatchObject({
      code: "framework-module/lifecycle-failed",
      message: expect.stringContaining("Module context belongs to a previous runtime graph"),
      extensions: {
        cleanupFailures: expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining("provider cleanup failed") }),
        ]),
      },
    });
  });
});
