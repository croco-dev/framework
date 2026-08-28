import { Container, Inject, Token } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { Container as FrameworkContainer } from "@croco/framework-context";
import {
  createApplicationRuntime,
  ModuleLifecycleProblem,
  ModuleRuntimeStaleContextProblem,
} from "../index";
import type { ModuleContext } from "../index";

describe("ApplicationRuntime", () => {
  beforeEach(() => {
    Container.reset();
    FrameworkContainer.reset();
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

  it("emits constructor edges for class and token-bound class providers", async () => {
    class Repository {}
    const configToken = new Token<string>("config");
    class Service {
      constructor(
        readonly repository: Repository,
        @Inject(configToken) readonly config: string,
      ) {}
    }
    const serviceToken = new Token<Service>("service");
    Reflect.defineMetadata("design:paramtypes", [Repository, String], Service);
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [
            Repository,
            Service,
            { provide: configToken, useValue: "configured" },
            { provide: serviceToken, useClass: Service },
          ],
        },
      ],
    });
    await runtime.initialize();

    const manifest = runtime.createGraphManifest();
    const serviceProviders = manifest.dependencyGraph.providers.filter(
      (provider) => provider.token === "Service" || provider.token === "Token<service>",
    );

    expect(manifest.status).toBe("ready");
    expect(serviceProviders).toHaveLength(2);
    expect(serviceProviders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dependencies: ["Repository", "Token<config>"] }),
        expect.objectContaining({ dependencies: ["Repository", "Token<config>"] }),
      ]),
    );

    await runtime.dispose();
  });

  it("reports missing and circular dependencies without TypeDI fallback", async () => {
    class MissingDependency {}
    class MissingConsumer {
      constructor(readonly dependency: MissingDependency) {}
    }
    class CircularLeft {
      constructor(readonly right: CircularRight) {}
    }
    class CircularRight {
      constructor(readonly left: CircularLeft) {}
    }
    Reflect.defineMetadata("design:paramtypes", [MissingDependency], MissingConsumer);
    Reflect.defineMetadata("design:paramtypes", [CircularRight], CircularLeft);
    Reflect.defineMetadata("design:paramtypes", [CircularLeft], CircularRight);
    const runtime = createApplicationRuntime({
      modules: [
        {
          name: "app",
          providers: [MissingConsumer, CircularLeft, CircularRight],
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
});
