import { Container, Inject, Service, Token } from "typedi";
import type { ContainerInstance } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createModuleRuntime,
  ModuleDiagnosticsProvider,
  ModuleLifecycleProblem,
  ModuleProviderUnavailableProblem,
  ModuleProviderVisibilityProblem,
  ModuleRuntimeDisposedProblem,
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

  it("keeps constructor and property injection inside the runtime container", async () => {
    const constructorToken = new Token<string>("constructor-config");
    const propertyToken = new Token<string>("property-config");
    Container.set({ id: constructorToken, value: "global-constructor", global: true });
    Container.set({ id: propertyToken, value: "global-property", global: true });

    @Service()
    class RuntimeService {
      @Inject(propertyToken)
      readonly propertyConfig: string | undefined;

      constructor(@Inject(constructorToken) readonly constructorConfig: string) {}
    }
    Reflect.defineMetadata("design:paramtypes", [String], RuntimeService);

    const runtime = createModuleRuntime();
    runtime.use({
      name: "app",
      providers: [
        { provide: constructorToken, useValue: "runtime-constructor" },
        { provide: propertyToken, useValue: "runtime-property" },
        RuntimeService,
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

    @Service()
    class ReflectedService {
      constructor(readonly dependency: RuntimeDependency) {}
    }
    Reflect.defineMetadata("design:paramtypes", [RuntimeDependency], ReflectedService);

    runtime.reset();
    runtime.use({ name: "reflected", providers: [RuntimeDependency, ReflectedService] });
    const reflectedContext = await runtime.initialize();
    expect(reflectedContext.get(ReflectedService).dependency).toBeInstanceOf(RuntimeDependency);
    expect(reflectedContext.get(ReflectedService).dependency.source).toBe("runtime");
    await runtime.dispose();
  });

  it("does not cache partially initialized services after property injection fails", async () => {
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

    const context = await runtime.initialize();
    expect(() => context.get(IncompleteService)).toThrow(ModuleProviderUnavailableProblem);
    expect(() => context.get(IncompleteService)).toThrow(ModuleProviderUnavailableProblem);
    await runtime.dispose();
  });

  it("does not expose the process-global container through class construction", async () => {
    const globalToken = new Token<string>("imperative-global-config");
    Container.set({ id: globalToken, value: "global", global: true });

    class ImperativeService {
      readonly config: string;

      constructor(container?: ContainerInstance) {
        this.config = container?.get(globalToken) ?? "missing";
      }
    }

    const runtime = createModuleRuntime();
    runtime.use({ name: "app", providers: [ImperativeService] });

    const context = await runtime.initialize();
    expect(() => context.get(ImperativeService)).toThrow(ModuleProviderUnavailableProblem);
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
