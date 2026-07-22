import { Container, Token } from "typedi";
import type { ServiceMetadata } from "typedi";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CrocoModule, ModuleDiagnosticsProvider, ModuleLifecycleProblem } from "../index";
import type { ModuleOptions } from "../types";

describe("module initialization rollback", () => {
  beforeEach(() => {
    CrocoModule.reset();
    Container.reset();
  });

  it("compensates the failing setup and previously entered modules in reverse order", async () => {
    const calls: string[] = [];
    const dependency: ModuleOptions = {
      name: "dependency",
      setup: () => {
        calls.push("dependency:setup");
      },
      shutdown: () => {
        calls.push("dependency:shutdown");
      },
    };
    CrocoModule.use({
      name: "app",
      imports: [dependency],
      setup: () => {
        calls.push("app:setup");
        throw new Error("setup failed");
      },
      shutdown: () => {
        calls.push("app:shutdown");
      },
    });

    await expect(CrocoModule.initialize()).rejects.toThrow("setup failed");

    expect(calls).toEqual(["dependency:setup", "app:setup", "app:shutdown", "dependency:shutdown"]);
    const health = await new ModuleDiagnosticsProvider().getHealth();
    expect(health.details).toMatchObject({
      initializedModuleCount: 0,
      modules: [
        { name: "dependency", phase: "stopped" },
        {
          name: "app",
          phase: "stopped",
          lastError: "Module 'app' failed during setup: setup failed",
        },
      ],
    });
  });

  it("compensates every setup module when start fails", async () => {
    const calls: string[] = [];
    const dependency: ModuleOptions = {
      name: "dependency",
      setup: () => {
        calls.push("dependency:setup");
      },
      start: () => {
        calls.push("dependency:start");
      },
      shutdown: () => {
        calls.push("dependency:shutdown");
      },
    };
    CrocoModule.use({
      name: "app",
      imports: [dependency],
      setup: () => {
        calls.push("app:setup");
      },
      start: () => {
        calls.push("app:start");
        throw new Error("start failed");
      },
      shutdown: () => {
        calls.push("app:shutdown");
      },
    });

    await expect(CrocoModule.initialize()).rejects.toThrow("start failed");

    expect(calls).toEqual([
      "dependency:setup",
      "app:setup",
      "dependency:start",
      "app:start",
      "app:shutdown",
      "dependency:shutdown",
    ]);
  });

  it("compensates setup-complete modules whose start hook was not reached", async () => {
    const calls: string[] = [];
    CrocoModule.use({
      name: "first",
      start: () => {
        calls.push("first:start");
      },
      shutdown: () => {
        calls.push("first:shutdown");
      },
    });
    CrocoModule.use({
      name: "middle",
      start: () => {
        calls.push("middle:start");
        throw new Error("middle failed");
      },
      shutdown: () => {
        calls.push("middle:shutdown");
      },
    });
    CrocoModule.use({
      name: "last",
      start: () => {
        calls.push("last:start");
      },
      shutdown: () => {
        calls.push("last:shutdown");
      },
    });

    await expect(CrocoModule.initialize()).rejects.toThrow("middle failed");

    expect(calls).toEqual([
      "first:start",
      "middle:start",
      "last:shutdown",
      "middle:shutdown",
      "first:shutdown",
    ]);
  });

  it("keeps the bootstrap failure primary and reports every cleanup failure", async () => {
    const dependency: ModuleOptions = {
      name: "dependency",
      setup: () => undefined,
      shutdown: () => {
        throw new Error("dependency cleanup failed");
      },
    };
    CrocoModule.use({
      name: "app",
      imports: [dependency],
      start: () => {
        throw new Error("bootstrap failed");
      },
      shutdown: () => {
        throw new Error("app cleanup failed");
      },
    });

    const failure = await CrocoModule.initialize().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ModuleLifecycleProblem);
    expect(failure).toMatchObject({
      message: "Module 'app' failed during start: bootstrap failed",
      extensions: {
        moduleName: "app",
        phase: "start",
        cleanupFailures: [
          {
            moduleName: "app",
            phase: "shutdown",
            code: "framework-module/lifecycle-failed",
            message: "Module 'app' failed during shutdown: app cleanup failed",
          },
          {
            moduleName: "dependency",
            phase: "shutdown",
            code: "framework-module/lifecycle-failed",
            message: "Module 'dependency' failed during shutdown: dependency cleanup failed",
          },
        ],
      },
    });

    const health = await new ModuleDiagnosticsProvider().getHealth();
    expect(health.details).toMatchObject({
      initializedModuleCount: 0,
      modules: [
        {
          name: "dependency",
          initialized: false,
          phase: "failed",
          cleanupFailures: [{ moduleName: "dependency", phase: "shutdown" }],
        },
        {
          name: "app",
          initialized: false,
          phase: "failed",
          lastError: "Module 'app' failed during start: bootstrap failed",
          cleanupFailures: [{ moduleName: "app", phase: "shutdown" }],
        },
      ],
    });
  });

  it("reports rollback while an asynchronous cleanup hook is running", async () => {
    let releaseCleanup: (() => void) | undefined;
    let markCleanupStarted: (() => void) | undefined;
    const cleanupGate = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    const cleanupStarted = new Promise<void>((resolve) => {
      markCleanupStarted = resolve;
    });
    CrocoModule.use({
      name: "app",
      start: () => {
        throw new Error("bootstrap failed");
      },
      shutdown: () => {
        markCleanupStarted?.();
        return cleanupGate;
      },
    });

    const initialization = CrocoModule.initialize();
    await cleanupStarted;

    const health = await new ModuleDiagnosticsProvider().getHealth();
    expect(health.details).toMatchObject({
      modules: [{ name: "app", initialized: false, phase: "rollback" }],
    });

    releaseCleanup?.();
    await expect(initialization).rejects.toThrow("bootstrap failed");
  });

  it("restores overwritten and newly registered providers before an explicit retry", async () => {
    const existingToken = new Token<string>("existing");
    const attemptToken = new Token<string>("attempt");
    Container.set(existingToken, "before");
    let shouldFail = true;
    CrocoModule.use({
      name: "app",
      providers: [
        { provide: existingToken, useValue: "during" },
        { provide: attemptToken, useValue: "attempt" },
      ],
      start: () => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("try again");
        }
      },
    });

    await expect(CrocoModule.initialize()).rejects.toThrow("try again");
    expect(Container.get(existingToken)).toBe("before");
    expect(Container.has(attemptToken)).toBe(false);

    await expect(CrocoModule.initialize()).resolves.toBeDefined();
    expect(Container.get(existingToken)).toBe("during");
    expect(Container.get(attemptToken)).toBe("attempt");
  });

  it("restores multiple provider records by identity without destroying existing values", async () => {
    const token = new Token<{ readonly destroy: () => void }>("multiple");
    const classToken = new Token<AttemptService>("attempt-class");
    const unrelatedToken = new Token<string>("unrelated");
    const destroyAttempt = vi.fn();
    class AttemptService {
      destroy(): void {
        destroyAttempt();
      }
    }
    const firstValue = { destroy: vi.fn() };
    const secondValue = { destroy: vi.fn() };
    Container.set({ id: token, multiple: true, value: firstValue });
    Container.set({ id: token, multiple: true, value: secondValue });
    const container = Container.of(undefined) as unknown as {
      readonly services: ServiceMetadata<unknown>[];
    };
    const originalRecords = [...container.services];

    CrocoModule.use({
      name: "app",
      providers: [
        { provide: token, useValue: { destroy: vi.fn() } },
        { provide: classToken, useClass: AttemptService },
      ],
      start: (context) => {
        context.get(classToken);
        Container.set(unrelatedToken, "survives");
        throw new Error("bootstrap failed");
      },
    });

    await expect(CrocoModule.initialize()).rejects.toThrow("bootstrap failed");

    expect(Container.getMany(token)).toEqual([firstValue, secondValue]);
    expect(container.services.filter((service) => service.id !== unrelatedToken)).toEqual(
      originalRecords,
    );
    expect(container.services[0]).toBe(originalRecords[0]);
    expect(container.services[1]).toBe(originalRecords[1]);
    expect(firstValue.destroy).not.toHaveBeenCalled();
    expect(secondValue.destroy).not.toHaveBeenCalled();
    expect(destroyAttempt).toHaveBeenCalledTimes(1);
    expect(Container.has(classToken)).toBe(false);
    expect(Container.get(unrelatedToken)).toBe("survives");
  });

  it("shares one in-flight initialization attempt", async () => {
    let releaseSetup: (() => void) | undefined;
    const setupGate = new Promise<void>((resolve) => {
      releaseSetup = resolve;
    });
    const setup = vi.fn(() => setupGate);
    CrocoModule.use({ name: "app", setup });

    const first = CrocoModule.initialize();
    const second = CrocoModule.initialize();

    expect(second).toBe(first);
    await Promise.resolve();
    expect(setup).toHaveBeenCalledTimes(1);
    releaseSetup?.();
    await first;
  });

  it("shares one failed attempt, compensates once, and leaves shutdown inactive", async () => {
    const cause = new Error("bootstrap failed");
    const setup = vi.fn();
    const shutdown = vi.fn();
    CrocoModule.use({
      name: "app",
      setup,
      start: () => {
        throw cause;
      },
      shutdown,
    });

    const first = CrocoModule.initialize();
    const second = CrocoModule.initialize();
    const [firstError, secondError] = await Promise.all([
      first.catch((error: unknown) => error),
      second.catch((error: unknown) => error),
    ]);

    expect(second).toBe(first);
    expect(secondError).toBe(firstError);
    expect(firstError).toMatchObject({ cause });
    expect(setup).toHaveBeenCalledTimes(1);
    expect(shutdown).toHaveBeenCalledTimes(1);

    await CrocoModule.shutdown();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("waits for an in-flight initialization before shutting down", async () => {
    let releaseSetup: (() => void) | undefined;
    const setupGate = new Promise<void>((resolve) => {
      releaseSetup = resolve;
    });
    const shutdown = vi.fn();
    CrocoModule.use({ name: "app", setup: () => setupGate, shutdown });

    const initialization = CrocoModule.initialize();
    const stopping = CrocoModule.shutdown();
    releaseSetup?.();

    await initialization;
    await stopping;
    expect(shutdown).toHaveBeenCalledTimes(1);

    const health = await new ModuleDiagnosticsProvider().getHealth();
    expect(health.details).toMatchObject({ initializedModuleCount: 0 });
  });

  it("fences an initialization attempt when the registry is reset", async () => {
    let releaseSetup: (() => void) | undefined;
    const setupGate = new Promise<void>((resolve) => {
      releaseSetup = resolve;
    });
    const shutdown = vi.fn();
    CrocoModule.use({ name: "stale", setup: () => setupGate, shutdown });

    const initialization = CrocoModule.initialize();
    CrocoModule.reset();
    releaseSetup?.();

    await expect(initialization).rejects.toThrow(
      "Module registry was reset during initialization.",
    );
    expect(shutdown).toHaveBeenCalledTimes(1);

    CrocoModule.use({ name: "fresh", setup: () => undefined });
    await expect(CrocoModule.initialize()).resolves.toBeDefined();
    const health = await new ModuleDiagnosticsProvider().getHealth();
    expect(health.details).toMatchObject({
      initializedModuleCount: 1,
      modules: [{ name: "fresh", phase: "started" }],
    });
  });
});
