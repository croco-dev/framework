import {
  Component as Service,
  GENERATED_DI_GRAPH_VERSION,
  Inject,
  RuntimeContainer as Container,
  Token,
  defineGeneratedDiGraph,
} from "@croco/framework-context";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createApplicationRuntime,
  createModuleRuntime,
  InvalidModuleDefinitionProblem,
  ModuleDiagnosticsProvider,
  ModuleLifecycleProblem,
  ModuleProviderUnavailableProblem,
  ModuleProviderVisibilityProblem,
  ModuleRegistrationConflictProblem,
  ModuleRuntimeDisposedProblem,
  ModuleRuntimeResetConflictProblem,
  ModuleRuntimeStaleContextProblem,
} from "../index";

describe("ModuleRuntime", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("isolates identical module names and provider tokens across concurrent runtimes", async () => {
    const configToken = new Token<string>("config");
    const firstRuntime = createModuleRuntime();
    const secondRuntime = createModuleRuntime();

    firstRuntime.use({
      name: "app",
      providers: [{ provide: configToken, useValue: "first" }],
    });
    secondRuntime.use({
      name: "app",
      providers: [{ provide: configToken, useValue: "second" }],
    });

    const [firstContext, secondContext] = await Promise.all([
      firstRuntime.initialize(),
      secondRuntime.initialize(),
    ]);

    expect(firstContext.get(configToken)).toBe("first");
    expect(secondContext.get(configToken)).toBe("second");

    await Promise.all([firstRuntime.dispose(), secondRuntime.dispose()]);
  });

  it("keeps initialize, shutdown, and reset state local to each runtime", async () => {
    const calls: string[] = [];
    const firstRuntime = createModuleRuntime();
    const secondRuntime = createModuleRuntime();

    firstRuntime.use({
      name: "app",
      start: () => {
        calls.push("first:start");
      },
      shutdown: () => {
        calls.push("first:shutdown");
      },
    });
    secondRuntime.use({
      name: "app",
      start: () => {
        calls.push("second:start");
      },
      shutdown: () => {
        calls.push("second:shutdown");
      },
    });

    const secondContext = await secondRuntime.initialize();
    await firstRuntime.initialize();
    await firstRuntime.shutdown();
    firstRuntime.reset();

    expect(await secondRuntime.initialize()).toBe(secondContext);
    expect(secondRuntime.getRegisteredModules()).toMatchObject([
      { name: "app", initialized: true, phase: "started" },
    ]);
    await expect(new ModuleDiagnosticsProvider(secondRuntime).getHealth()).resolves.toMatchObject({
      status: "healthy",
      details: { initializedModuleCount: 1, registeredModuleCount: 1 },
    });
    expect(calls).toEqual(["second:start", "first:start", "first:shutdown"]);

    await Promise.all([firstRuntime.dispose(), secondRuntime.dispose()]);
    expect(calls).toEqual(["second:start", "first:start", "first:shutdown", "second:shutdown"]);
  });

  it("removes providers from an isolated container when reset", async () => {
    const serviceToken = new Token<string>("service");
    const runtime = createModuleRuntime();

    runtime.use({
      name: "first",
      providers: [{ provide: serviceToken, useValue: "stale" }],
    });
    await runtime.initialize();
    runtime.reset();

    runtime.use({
      name: "second",
      providers: [serviceToken],
      setup: (context) => {
        context.get(serviceToken);
      },
    });

    await expect(runtime.initialize()).rejects.toMatchObject({
      cause: expect.any(ModuleProviderUnavailableProblem),
    });
    await runtime.dispose();
  });

  it("does not resolve providers from the process-global container", async () => {
    const undeclaredToken = new Token<string>("undeclared-global-config");
    const unboundToken = new Token<string>("declared-global-config");
    const shadowedToken = new Token<string>("shadowed-global-config");
    Container.set(undeclaredToken, "global");
    Container.set({ id: unboundToken, value: "global", global: true });
    Container.set({ id: shadowedToken, value: "global", global: true });
    const runtime = createModuleRuntime();

    runtime.use({
      name: "app",
      providers: [unboundToken, { provide: shadowedToken, useValue: "runtime" }],
      setup: (context) => {
        context.get(undeclaredToken);
      },
    });

    await expect(runtime.initialize()).rejects.toMatchObject({
      cause: expect.any(ModuleProviderVisibilityProblem),
    });
    await expect(runtime.initialize()).rejects.toBeInstanceOf(ModuleLifecycleProblem);

    runtime.reset();
    runtime.use({
      name: "app",
      providers: [unboundToken, { provide: shadowedToken, useValue: "runtime" }],
    });
    const context = await runtime.initialize();
    expect(() => context.get(unboundToken)).toThrow(ModuleProviderUnavailableProblem);
    expect(context.get(shadowedToken)).toBe("runtime");
    await runtime.dispose();
  });

  it("reports unknown class dependencies in isolated runtime manifests", async () => {
    class UnknownDependency {}

    class RuntimeService {
      constructor(readonly dependency: UnknownDependency) {}
    }
    Reflect.defineMetadata("design:paramtypes", [UnknownDependency], RuntimeService);
    Inject(() => UnknownDependency)(RuntimeService, undefined, 0);

    const runtime = createModuleRuntime();
    runtime.use({ name: "app", providers: [RuntimeService] });

    expect(runtime.createGraphManifest()).toMatchObject({
      status: "failed",
      diagnostics: [
        {
          code: "framework-module/provider-injection-uninspectable",
          moduleName: "app",
          token: "RuntimeService",
          path: ["app", "RuntimeService", "parameter:0"],
        },
      ],
    });
    await expect(runtime.initialize()).rejects.toMatchObject({
      cause: expect.any(InvalidModuleDefinitionProblem),
    });
    await runtime.dispose();
  });

  it("checks generated dependencies against module exports, including useClass aliases", async () => {
    class Secret {}
    class Consumer {
      constructor(readonly secret: Secret) {}
    }
    const alias = new Token<Consumer>("consumer-alias");
    const generatedGraph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "module-visibility",
      compilerVersion: "test",
      inputHash: "module-visibility",
      roots: [Consumer],
      providers: [
        {
          token: Secret,
          tokenId: "app:Secret",
          debugName: "Secret",
          scope: "singleton",
          dependencies: [],
          factory: () => new Secret(),
          sourceLocation: { file: "src/Secret.ts", line: 1, column: 1 },
        },
        {
          token: Consumer,
          tokenId: "app:Consumer",
          debugName: "Consumer",
          scope: "singleton",
          dependencies: [{ token: Secret, tokenId: "app:Secret", parameterIndex: 0 }],
          factory: (resolver) => new Consumer(resolver.get(Secret)),
          sourceLocation: { file: "src/Consumer.ts", line: 1, column: 1 },
        },
      ],
    });
    const secrets = { name: "secrets", providers: [Secret] };

    for (const provider of [Consumer, { provide: alias, useClass: Consumer }]) {
      const runtime = createApplicationRuntime({
        generatedGraph,
        modules: [secrets, { name: "consumers", providers: [provider] }],
      });

      expect(runtime.createGraphManifest().moduleGraph.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "framework-module/provider-not-visible",
          moduleName: "consumers",
          token: "Secret",
          path: ["consumers", "Consumer", "Secret"],
        }),
      );
      await expect(runtime.initialize()).rejects.toMatchObject({
        cause: expect.any(ModuleProviderVisibilityProblem),
      });
      await runtime.dispose();
    }

    const exportedSecrets = { ...secrets, exports: [Secret] };
    let resolved: Consumer | undefined;
    const runtime = createApplicationRuntime({
      generatedGraph,
      modules: [
        exportedSecrets,
        {
          name: "consumers",
          imports: [exportedSecrets],
          providers: [Consumer, { provide: alias, useClass: Consumer }],
          setup: (context) => {
            resolved = context.get(alias);
          },
        },
      ],
    });

    expect(runtime.createGraphManifest().moduleGraph.status).toBe("ready");
    await runtime.initialize();
    expect(resolved?.secret).toBeInstanceOf(Secret);
    expect(runtime.get(alias)).toBe(resolved);
    await runtime.dispose();
  });

  it("accepts absent optional generated edges but still rejects known private ones", async () => {
    const optionalToken = new Token<string>("optional-config");
    class Consumer {
      constructor(readonly config: string | undefined) {}
    }
    const generatedGraph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "optional-module-dependency",
      compilerVersion: "test",
      inputHash: "optional-module-dependency",
      roots: [Consumer],
      providers: [
        {
          token: Consumer,
          tokenId: "app:Consumer",
          debugName: "Consumer",
          scope: "singleton",
          dependencies: [{ token: optionalToken, tokenId: "app:optional", optional: true }],
          factory: (resolver) => new Consumer(resolver.getOptional(optionalToken)),
          sourceLocation: { file: "src/Consumer.ts", line: 1, column: 1 },
        },
      ],
    });
    const absent = createApplicationRuntime({
      generatedGraph,
      modules: [{ name: "consumers", providers: [Consumer] }],
    });

    expect(absent.createGraphManifest().moduleGraph.status).toBe("ready");
    await absent.initialize();
    expect(absent.get(Consumer).config).toBeUndefined();
    await absent.dispose();

    const privateToken = {
      name: "secrets",
      providers: [{ provide: optionalToken, useValue: "secret" }],
    };
    const privateDependency = createApplicationRuntime({
      generatedGraph,
      modules: [privateToken, { name: "consumers", providers: [Consumer] }],
    });

    expect(privateDependency.createGraphManifest().moduleGraph.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "framework-module/provider-not-visible",
        moduleName: "consumers",
        token: "optional-config",
      }),
    );
    await expect(privateDependency.initialize()).rejects.toMatchObject({
      cause: expect.any(ModuleProviderVisibilityProblem),
    });
    await privateDependency.dispose();
  });

  it("rejects app-owned generated providers that depend on private module providers", async () => {
    class Secret {}
    class Consumer {
      constructor(readonly secret: Secret) {}
    }
    const generatedGraph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "application-private-dependency",
      compilerVersion: "test",
      inputHash: "application-private-dependency",
      roots: [Consumer],
      providers: [
        {
          token: Secret,
          tokenId: "app:Secret",
          debugName: "Secret",
          scope: "singleton",
          dependencies: [],
          factory: () => new Secret(),
          sourceLocation: { file: "src/Secret.ts", line: 1, column: 1 },
        },
        {
          token: Consumer,
          tokenId: "app:Consumer",
          debugName: "Consumer",
          scope: "singleton",
          dependencies: [{ token: Secret, tokenId: "app:Secret" }],
          factory: (resolver) => new Consumer(resolver.get(Secret)),
          sourceLocation: { file: "src/Consumer.ts", line: 1, column: 1 },
        },
      ],
    });
    const secrets = { name: "secrets", providers: [Secret] };
    const privateDependency = createApplicationRuntime({ generatedGraph, modules: [secrets] });

    expect(privateDependency.createGraphManifest().moduleGraph.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "framework-module/provider-not-visible",
        moduleName: "<application>",
        token: "Secret",
        path: ["<application>", "Consumer", "Secret"],
      }),
    );
    await expect(privateDependency.initialize()).rejects.toBeInstanceOf(
      ModuleProviderVisibilityProblem,
    );
    await privateDependency.dispose();

    const exportedSecrets = { ...secrets, exports: [Secret] };
    const exportedDependency = createApplicationRuntime({
      generatedGraph,
      modules: [exportedSecrets],
    });

    expect(exportedDependency.createGraphManifest().moduleGraph.status).toBe("ready");
    await exportedDependency.initialize();
    expect(exportedDependency.get(Consumer).secret).toBeInstanceOf(Secret);
    await exportedDependency.dispose();
  });

  it("keeps useClass implementations private even when their alias is exported", async () => {
    class Secret {}
    class Consumer {
      constructor(readonly secret: Secret) {}
    }
    const alias = new Token<Secret>("secret-alias");
    const generatedGraph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "private-implementation-alias",
      compilerVersion: "test",
      inputHash: "private-implementation-alias",
      roots: [Consumer],
      providers: [
        {
          token: Secret,
          tokenId: "app:Secret",
          debugName: "Secret",
          scope: "singleton",
          dependencies: [],
          factory: () => new Secret(),
          sourceLocation: { file: "src/Secret.ts", line: 1, column: 1 },
        },
        {
          token: Consumer,
          tokenId: "app:Consumer",
          debugName: "Consumer",
          scope: "singleton",
          dependencies: [{ token: Secret, tokenId: "app:Secret" }],
          factory: (resolver) => new Consumer(resolver.get(Secret)),
          sourceLocation: { file: "src/Consumer.ts", line: 1, column: 1 },
        },
      ],
    });

    for (const exports of [[], [alias]]) {
      const runtime = createApplicationRuntime({
        generatedGraph,
        modules: [
          {
            name: "secrets",
            providers: [{ provide: alias, useClass: Secret }],
            exports,
          },
        ],
      });

      expect(runtime.createGraphManifest().moduleGraph.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "framework-module/provider-not-visible",
          moduleName: "<application>",
          token: "Secret",
          path: ["<application>", "Consumer", "Secret"],
        }),
      );
      await expect(runtime.initialize()).rejects.toBeInstanceOf(ModuleProviderVisibilityProblem);
      await runtime.dispose();
    }

    const local = createApplicationRuntime({
      generatedGraph,
      modules: [
        {
          name: "secrets",
          providers: [{ provide: alias, useClass: Secret }, Consumer],
        },
      ],
    });

    expect(local.createGraphManifest().moduleGraph.status).toBe("ready");
    await local.initialize();
    expect(local.get(Consumer).secret).toBeInstanceOf(Secret);
    await local.dispose();
  });

  it("keeps explicit factories inside the runtime container", async () => {
    const constructorToken = new Token<string>("constructor-config");
    const propertyToken = new Token<string>("property-config");
    Container.set({ id: constructorToken, value: "global-constructor", global: true });
    Container.set({ id: propertyToken, value: "global-property", global: true });

    class RuntimeService {
      constructor(
        readonly constructorConfig: string,
        readonly propertyConfig: string,
      ) {}
    }

    const runtime = createModuleRuntime();
    runtime.use({
      name: "app",
      providers: [
        { provide: constructorToken, useValue: "runtime-constructor" },
        { provide: propertyToken, useValue: "runtime-property" },
        {
          provide: RuntimeService,
          useFactory: (context) =>
            new RuntimeService(context.get(constructorToken), context.get(propertyToken)),
        },
      ],
    });

    const context = await runtime.initialize();
    expect(context.get(RuntimeService)).toMatchObject({
      constructorConfig: "runtime-constructor",
      propertyConfig: "runtime-property",
    });

    class RuntimeDependency {
      readonly source = "runtime";
    }

    class GlobalDependency {
      readonly source = "global";
    }

    Container.set({ id: RuntimeDependency, type: GlobalDependency, global: true });

    class ReflectedService {
      constructor(readonly dependency: RuntimeDependency) {}
    }

    runtime.reset();
    runtime.use({
      name: "reflected",
      providers: [
        RuntimeDependency,
        {
          provide: ReflectedService,
          useFactory: (context) => new ReflectedService(context.get(RuntimeDependency)),
        },
      ],
    });
    const reflectedContext = await runtime.initialize();
    expect(reflectedContext.get(ReflectedService).dependency).toBeInstanceOf(RuntimeDependency);
    expect(reflectedContext.get(ReflectedService).dependency.source).toBe("runtime");
    await runtime.dispose();
  });

  it("rejects uncompiled property injection before provider registration", async () => {
    const missingPropertyToken = new Token<string>("missing-property-config");

    @Service()
    class IncompleteService {
      @Inject(missingPropertyToken)
      readonly propertyConfig: string | undefined;
    }

    const runtime = createModuleRuntime();
    runtime.use({
      name: "app",
      providers: [missingPropertyToken, IncompleteService],
    });

    await expect(runtime.initialize()).rejects.toMatchObject({
      cause: expect.any(InvalidModuleDefinitionProblem),
    });
    await runtime.dispose();
  });

  it("rejects constructor parameters without a generated edge or explicit factory", async () => {
    const globalToken = new Token<string>("imperative-global-config");
    Container.set({ id: globalToken, value: "global", global: true });

    class ImperativeService {
      readonly config: string;

      constructor(config: string) {
        this.config = config;
      }
    }

    const runtime = createModuleRuntime();
    runtime.use({ name: "app", providers: [ImperativeService] });

    await expect(runtime.initialize()).rejects.toMatchObject({
      cause: expect.any(InvalidModuleDefinitionProblem),
    });
    await runtime.dispose();
  });

  it("invalidates root and lifecycle contexts when reset replaces the graph", async () => {
    const serviceToken = new Token<string>("generation-config");
    let readLifecycleContext = (): string => "not-captured";
    const runtime = createModuleRuntime();

    runtime.use({
      name: "first",
      providers: [{ provide: serviceToken, useValue: "first" }],
      setup: (context) => {
        readLifecycleContext = () => context.get(serviceToken);
      },
    });
    const previousRootContext = await runtime.initialize();
    expect(readLifecycleContext()).toBe("first");

    runtime.reset();
    runtime.use({
      name: "second",
      providers: [{ provide: serviceToken, useValue: "second" }],
    });
    const currentRootContext = await runtime.initialize();

    expect(() => previousRootContext.get(serviceToken)).toThrow(ModuleRuntimeStaleContextProblem);
    expect(readLifecycleContext).toThrow(ModuleRuntimeStaleContextProblem);
    expect(currentRootContext.get(serviceToken)).toBe("second");
    await runtime.dispose();
  });

  it("rejects reset while lifecycle work can still mutate the runtime", async () => {
    let finishSetup: (() => void) | undefined;
    let markSetupStarted: (() => void) | undefined;
    const setupBarrier = new Promise<void>((resolve) => {
      finishSetup = resolve;
    });
    const setupStarted = new Promise<void>((resolve) => {
      markSetupStarted = resolve;
    });
    const calls: string[] = [];
    const runtime = createModuleRuntime();

    runtime.use({
      name: "app",
      setup: async () => {
        calls.push("old:setup");
        markSetupStarted?.();
        await setupBarrier;
      },
      start: () => {
        calls.push("old:start");
      },
    });

    const initialization = runtime.initialize();
    await setupStarted;
    expect(() => runtime.reset()).toThrow(ModuleRuntimeResetConflictProblem);
    expect(() => runtime.use({ name: "app", setup: () => undefined })).toThrow(
      ModuleRegistrationConflictProblem,
    );

    finishSetup?.();
    await initialization;
    runtime.reset();
    runtime.use({
      name: "app",
      start: () => {
        calls.push("fresh:start");
      },
    });
    await runtime.initialize();

    expect(calls).toEqual(["old:setup", "old:start", "fresh:start"]);
    await runtime.dispose();
  });

  it("rejects reset until active shutdown finishes", async () => {
    let finishShutdown: (() => void) | undefined;
    let markShutdownStarted: (() => void) | undefined;
    const shutdownBarrier = new Promise<void>((resolve) => {
      finishShutdown = resolve;
    });
    const shutdownStarted = new Promise<void>((resolve) => {
      markShutdownStarted = resolve;
    });
    const runtime = createModuleRuntime();

    runtime.use({
      name: "app",
      shutdown: async () => {
        markShutdownStarted?.();
        await shutdownBarrier;
      },
    });
    await runtime.initialize();

    const shutdown = runtime.shutdown();
    await shutdownStarted;
    expect(() => runtime.reset()).toThrow(ModuleRuntimeResetConflictProblem);

    finishShutdown?.();
    await shutdown;
    runtime.reset();
    expect(runtime.getRegisteredModules()).toEqual([]);
    await runtime.dispose();
  });

  it("shuts down, releases providers, and rejects reuse when disposed", async () => {
    const serviceToken = new Token<object>("service");
    const service = {};
    const calls: string[] = [];
    const runtime = createModuleRuntime();

    runtime.use({
      name: "app",
      providers: [{ provide: serviceToken, useValue: service }],
      shutdown: () => {
        calls.push("shutdown");
      },
    });

    const context = await runtime.initialize();
    expect(context.get(serviceToken)).toBe(service);

    await runtime.dispose();
    await runtime.dispose();

    expect(calls).toEqual(["shutdown"]);
    expect(() => context.get(serviceToken)).toThrow(ModuleRuntimeDisposedProblem);
    expect(() => runtime.use({ name: "other", setup: () => undefined })).toThrow(
      ModuleRuntimeDisposedProblem,
    );
    await expect(runtime.initialize()).rejects.toThrow(ModuleRuntimeDisposedProblem);
  });

  it("joins initialization and runs shutdown once across concurrent dispose calls", async () => {
    let finishSetup: (() => void) | undefined;
    let shutdownCount = 0;
    const serviceToken = new Token<string>("service");
    const observedServices: string[] = [];
    const setupBarrier = new Promise<void>((resolve) => {
      finishSetup = resolve;
    });
    const runtime = createModuleRuntime();

    runtime.use({
      name: "app",
      providers: [{ provide: serviceToken, useValue: "value" }],
      setup: async (context) => {
        await setupBarrier;
        observedServices.push(context.get(serviceToken));
      },
      shutdown: (context) => {
        observedServices.push(context.get(serviceToken));
        shutdownCount += 1;
      },
    });

    const initialization = runtime.initialize();
    expect(runtime.initialize()).toBe(initialization);
    const firstDispose = runtime.dispose();
    const secondDispose = runtime.dispose();
    finishSetup?.();

    await Promise.all([initialization, firstDispose, secondDispose]);
    expect(shutdownCount).toBe(1);
    expect(observedServices).toEqual(["value", "value"]);
  });

  it("releases the runtime and keeps it terminal when shutdown fails during dispose", async () => {
    const serviceToken = new Token<string>("service");
    const runtime = createModuleRuntime();

    runtime.use({
      name: "app",
      providers: [{ provide: serviceToken, useValue: "value" }],
      shutdown: () => {
        throw new Error("cleanup failed");
      },
    });

    const context = await runtime.initialize();
    await expect(runtime.dispose()).rejects.toBeInstanceOf(ModuleLifecycleProblem);

    expect(() => context.get(serviceToken)).toThrow(ModuleRuntimeDisposedProblem);
    expect(() => runtime.reset()).toThrow(ModuleRuntimeDisposedProblem);
    await expect(runtime.dispose()).resolves.toBeUndefined();
  });
});
