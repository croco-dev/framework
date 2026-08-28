import { Container } from "typedi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createModuleRuntime,
  InvalidModuleLifecycleDeadlineProblem,
  ModuleLifecycleCancelledProblem,
  ModuleLifecycleDeadlineExceededProblem,
} from "../index";

describe("module lifecycle cancellation", () => {
  beforeEach(() => {
    Container.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("provides the same execution contract to setup, start, and shutdown hooks", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(500_000);
    const phases: string[] = [];
    const signals: AbortSignal[] = [];
    const parent = new AbortController();
    const deadline = Date.now() + 100;
    const runtime = createModuleRuntime();

    runtime.use({
      name: "app",
      setup: (moduleContext, execution) => {
        expect(execution.moduleContext).toBe(moduleContext);
        expect(execution.phase).toBe("setup");
        expect(execution.deadline).toBe(deadline);
        phases.push(execution.phase);
        signals.push(execution.signal);
      },
      start: (moduleContext, execution) => {
        expect(execution.moduleContext).toBe(moduleContext);
        expect(execution.phase).toBe("start");
        expect(execution.deadline).toBe(deadline);
        phases.push(execution.phase);
        signals.push(execution.signal);
      },
      shutdown: (moduleContext, execution) => {
        expect(execution.moduleContext).toBe(moduleContext);
        expect(execution.phase).toBe("shutdown");
        expect(execution.deadline).toBeUndefined();
        phases.push(execution.phase);
        signals.push(execution.signal);
      },
    });

    await runtime.initialize({ signal: parent.signal, deadline });
    await vi.advanceTimersByTimeAsync(100);
    parent.abort(new Error("late parent abort"));

    expect(signals.slice(0, 2).every((signal) => !signal.aborted)).toBe(true);

    await runtime.shutdown();
    expect(phases).toEqual(["setup", "start", "shutdown"]);
    expect(signals.every((signal) => !signal.aborted)).toBe(true);
    await runtime.dispose();
  });

  it("propagates an in-flight parent abort and never records initialization success", async () => {
    const parent = new AbortController();
    let observedSignal: AbortSignal | undefined;
    let startCalled = false;
    const runtime = createModuleRuntime();

    runtime.use({
      name: "app",
      setup: async (_moduleContext, execution) => {
        observedSignal = execution.signal;
        await new Promise<void>((resolve) => {
          execution.signal.addEventListener("abort", () => resolve(), { once: true });
        });
      },
      start: () => {
        startCalled = true;
      },
    });

    const initialization = runtime.initialize({ signal: parent.signal });
    await vi.waitFor(() => expect(observedSignal).toBeDefined());
    const cause = new Error("operator requested shutdown");
    parent.abort(cause);

    await expect(initialization).rejects.toMatchObject({
      code: "framework-module/lifecycle-cancelled",
      cause,
      extensions: {
        moduleName: "app",
        phase: "setup",
        source: "parent",
      },
    });
    expect(observedSignal?.aborted).toBe(true);
    expect(observedSignal?.reason).toBeInstanceOf(ModuleLifecycleCancelledProblem);
    expect(startCalled).toBe(false);
    expect(runtime.getRegisteredModules()).toMatchObject([{ name: "app", initialized: false }]);
    await runtime.dispose();
  });

  it("stops provider and setup work after cancellation during an async provider factory", async () => {
    let finishProvider: (() => void) | undefined;
    let markProviderStarted: (() => void) | undefined;
    const providerBarrier = new Promise<void>((resolve) => {
      finishProvider = resolve;
    });
    const providerStarted = new Promise<void>((resolve) => {
      markProviderStarted = resolve;
    });
    const parent = new AbortController();
    const secondProvider = vi.fn(() => "second");
    const setup = vi.fn();
    const runtime = createModuleRuntime();

    runtime.use({
      name: "app",
      providers: [
        {
          provide: "first",
          useFactory: async () => {
            markProviderStarted?.();
            await providerBarrier;
            return "first";
          },
        },
        { provide: "second", useFactory: secondProvider },
      ],
      setup,
    });

    const initialization = runtime.initialize({ signal: parent.signal });
    await providerStarted;
    parent.abort();
    finishProvider?.();

    await expect(initialization).rejects.toBeInstanceOf(ModuleLifecycleCancelledProblem);
    expect(secondProvider).not.toHaveBeenCalled();
    expect(setup).not.toHaveBeenCalled();
    await runtime.dispose();
  });

  it("rejects a pre-aborted initialization before entering setup", async () => {
    const parent = new AbortController();
    const setup = vi.fn();
    const runtime = createModuleRuntime();
    parent.abort();

    runtime.use({ name: "app", setup });

    await expect(runtime.initialize({ signal: parent.signal })).rejects.toBeInstanceOf(
      ModuleLifecycleCancelledProblem,
    );
    expect(setup).not.toHaveBeenCalled();
    expect(runtime.getRegisteredModules()).toMatchObject([{ name: "app", initialized: false }]);
    await runtime.dispose();
  });

  it("distinguishes deadline expiry from a user hook failure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const deadline = Date.now() + 100;
    const runtime = createModuleRuntime();

    runtime.use({
      name: "app",
      start: async (_moduleContext, execution) => {
        await new Promise<void>((resolve) => {
          execution.signal.addEventListener("abort", () => resolve(), { once: true });
        });
      },
    });

    const initializationFailure = runtime.initialize({ deadline }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(100);
    const failure = await initializationFailure;

    expect(failure).toMatchObject({
      code: "framework-module/lifecycle-deadline-exceeded",
      extensions: { moduleName: "app", phase: "start", deadline },
    });
    await runtime.dispose();

    const failingRuntime = createModuleRuntime();
    const hookFailure = new DOMException("hook aborted itself", "AbortError");
    failingRuntime.use({
      name: "failing",
      start: () => {
        throw hookFailure;
      },
    });

    await expect(failingRuntime.initialize({ deadline: Date.now() + 100 })).rejects.toMatchObject({
      code: "framework-module/lifecycle-failed",
      cause: hookFailure,
    });
    await failingRuntime.dispose();
  });

  it("observes an elapsed deadline after a synchronous initialization hook settles", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_500_000);
    const returnDeadline = Date.now() + 100;
    const returningRuntime = createModuleRuntime();
    returningRuntime.use({
      name: "returning",
      start: () => {
        vi.setSystemTime(returnDeadline + 1);
      },
    });

    await expect(returningRuntime.initialize({ deadline: returnDeadline })).rejects.toMatchObject({
      code: "framework-module/lifecycle-deadline-exceeded",
      extensions: { moduleName: "returning", phase: "start", deadline: returnDeadline },
    });
    await returningRuntime.dispose();

    vi.setSystemTime(1_600_000);
    const throwDeadline = Date.now() + 100;
    const hookFailure = new Error("late initialization failure");
    const throwingRuntime = createModuleRuntime();
    throwingRuntime.use({
      name: "throwing",
      start: () => {
        vi.setSystemTime(throwDeadline + 1);
        throw hookFailure;
      },
    });

    await expect(throwingRuntime.initialize({ deadline: throwDeadline })).rejects.toMatchObject({
      code: "framework-module/lifecycle-deadline-exceeded",
      extensions: {
        moduleName: "throwing",
        phase: "start",
        deadline: throwDeadline,
        hookFailure: {
          moduleName: "throwing",
          phase: "start",
          code: "framework-module/lifecycle-failed",
        },
      },
    });
    await throwingRuntime.dispose();
  });

  it("observes an elapsed deadline after a synchronous shutdown hook settles", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000);
    const returnDeadline = Date.now() + 100;
    const returningRuntime = createModuleRuntime();
    returningRuntime.use({
      name: "returning",
      shutdown: () => {
        vi.setSystemTime(returnDeadline + 1);
      },
    });
    await returningRuntime.initialize();

    await expect(returningRuntime.shutdown({ deadline: returnDeadline })).rejects.toMatchObject({
      code: "framework-module/lifecycle-deadline-exceeded",
      extensions: { moduleName: "returning", phase: "shutdown", deadline: returnDeadline },
    });
    await returningRuntime.dispose();

    vi.setSystemTime(1_800_000);
    const throwDeadline = Date.now() + 100;
    const hookFailure = new Error("late shutdown failure");
    const throwingRuntime = createModuleRuntime();
    throwingRuntime.use({
      name: "throwing",
      shutdown: () => {
        vi.setSystemTime(throwDeadline + 1);
        throw hookFailure;
      },
    });
    await throwingRuntime.initialize();

    await expect(throwingRuntime.shutdown({ deadline: throwDeadline })).rejects.toMatchObject({
      code: "framework-module/lifecycle-deadline-exceeded",
      extensions: {
        moduleName: "throwing",
        phase: "shutdown",
        deadline: throwDeadline,
        hookFailure: {
          moduleName: "throwing",
          phase: "shutdown",
          code: "framework-module/lifecycle-failed",
        },
      },
    });
    await throwingRuntime.dispose();
  });

  it("rejects an expired deadline before entering setup", async () => {
    const setup = vi.fn();
    const runtime = createModuleRuntime();
    runtime.use({ name: "app", setup });

    await expect(runtime.initialize({ deadline: Date.now() - 1 })).rejects.toBeInstanceOf(
      ModuleLifecycleDeadlineExceededProblem,
    );
    expect(setup).not.toHaveBeenCalled();
    await runtime.dispose();
  });

  it("attempts every shutdown hook after the deadline signal aborts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    const deadline = Date.now() + 100;
    const calls: string[] = [];
    const dependency = {
      name: "dependency",
      shutdown: (_moduleContext: unknown, execution: { signal: AbortSignal }) => {
        calls.push(`dependency:${String(execution.signal.aborted)}`);
      },
    };
    const runtime = createModuleRuntime();

    runtime.use({
      name: "app",
      imports: [dependency],
      shutdown: async (_moduleContext, execution) => {
        calls.push(`app:${String(execution.signal.aborted)}`);
        await new Promise<void>((resolve) => {
          execution.signal.addEventListener("abort", () => resolve(), { once: true });
        });
      },
    });
    await runtime.initialize();

    const shutdownFailure = runtime.shutdown({ deadline }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(100);
    const failure = await shutdownFailure;

    expect(failure).toBeInstanceOf(ModuleLifecycleDeadlineExceededProblem);
    expect(failure).toMatchObject({
      extensions: {
        cleanupFailures: [
          { moduleName: "app", code: "framework-module/lifecycle-deadline-exceeded" },
          { moduleName: "dependency", code: "framework-module/lifecycle-deadline-exceeded" },
        ],
      },
    });
    expect(calls).toEqual(["app:false", "dependency:true"]);
    expect(runtime.getRegisteredModules().every((module) => !module.initialized)).toBe(true);
    await runtime.dispose();
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    "rejects invalid lifecycle deadline %s before hook execution",
    async (deadline) => {
      const setup = vi.fn();
      const runtime = createModuleRuntime();
      runtime.use({ name: "app", setup });

      await expect(runtime.initialize({ deadline })).rejects.toBeInstanceOf(
        InvalidModuleLifecycleDeadlineProblem,
      );
      expect(setup).not.toHaveBeenCalled();
      await runtime.dispose();
    },
  );

  it("validates shutdown deadlines before cleanup starts", async () => {
    const shutdown = vi.fn();
    const runtime = createModuleRuntime();
    runtime.use({ name: "app", shutdown });
    await runtime.initialize();

    await expect(runtime.shutdown({ deadline: 0 })).rejects.toMatchObject({
      code: "framework-module/lifecycle-deadline-invalid",
      extensions: { operation: "shutdown", receivedValue: "0" },
    });
    expect(shutdown).not.toHaveBeenCalled();
    await runtime.dispose();
  });

  it("does not report shutdown success when cancellation arrives without cleanup hooks", async () => {
    const parent = new AbortController();
    const runtime = createModuleRuntime();
    runtime.use({ name: "app", setup: () => undefined });
    await runtime.initialize();
    parent.abort();

    await expect(runtime.shutdown({ signal: parent.signal })).rejects.toMatchObject({
      code: "framework-module/lifecycle-cancelled",
      extensions: { moduleName: "<registry>", phase: "shutdown", source: "parent" },
    });
    expect(runtime.getRegisteredModules()).toMatchObject([{ name: "app", initialized: false }]);
    await runtime.dispose();
  });

  it("preserves a cleanup hook failure observed after parent cancellation", async () => {
    const parent = new AbortController();
    const cleanupError = new Error("cleanup failed after cancellation");
    const runtime = createModuleRuntime();
    runtime.use({
      name: "app",
      setup: () => undefined,
      shutdown: () => {
        throw cleanupError;
      },
    });
    await runtime.initialize();
    parent.abort(new Error("operator requested shutdown"));

    await expect(runtime.shutdown({ signal: parent.signal })).rejects.toMatchObject({
      code: "framework-module/lifecycle-cancelled",
      extensions: {
        hookFailure: {
          moduleName: "app",
          phase: "shutdown",
          code: "framework-module/lifecycle-failed",
        },
        cleanupFailures: [{ moduleName: "app", code: "framework-module/lifecycle-cancelled" }],
      },
    });
    await runtime.dispose();
  });

  it("keeps first-caller ownership for a shared initialization attempt", async () => {
    let finishSetup: (() => void) | undefined;
    let observedSignal: AbortSignal | undefined;
    const setupBarrier = new Promise<void>((resolve) => {
      finishSetup = resolve;
    });
    const owner = new AbortController();
    const joiner = new AbortController();
    const runtime = createModuleRuntime();

    runtime.use({
      name: "app",
      setup: async (_moduleContext, execution) => {
        observedSignal = execution.signal;
        await setupBarrier;
      },
    });

    const initialization = runtime.initialize({ signal: owner.signal });
    const joinedInitialization = runtime.initialize({ signal: joiner.signal });
    const invalidJoinedInitialization = runtime.initialize({ deadline: 0 });
    expect(joinedInitialization).toBe(initialization);
    expect(invalidJoinedInitialization).toBe(initialization);
    joiner.abort();
    finishSetup?.();

    await expect(initialization).resolves.toBeDefined();
    expect(observedSignal?.aborted).toBe(false);
    await runtime.dispose();
  });

  it("ignores unused options from callers joining an active shutdown", async () => {
    let finishShutdown: (() => void) | undefined;
    const shutdownBarrier = new Promise<void>((resolve) => {
      finishShutdown = resolve;
    });
    const shutdown = vi.fn(async () => {
      await shutdownBarrier;
    });
    const runtime = createModuleRuntime();
    runtime.use({ name: "app", setup: () => undefined, shutdown });
    await runtime.initialize();

    const ownerShutdown = runtime.shutdown();
    const joinedShutdown = runtime.shutdown({ deadline: 0 });
    finishShutdown?.();

    await expect(Promise.all([ownerShutdown, joinedShutdown])).resolves.toEqual([
      undefined,
      undefined,
    ]);
    expect(shutdown).toHaveBeenCalledOnce();
    await runtime.dispose();
  });
});
