// croco-test-clock: controlled
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Container,
  Context,
  MetadataStorage,
  defineGeneratedDiGraph,
} from "@croco/framework-context";
import { createApplicationRuntime, defineCrocoApplication } from "@croco/framework-module";
import { ExecutionManagerImpl } from "@croco/execution-core";
import { Cron } from "@croco/triggers-core";
import { Task } from "@croco/tasks-core";
import type { TaskExecutionContext } from "@croco/tasks-core";
import { ProblemFactory } from "@croco/problems-core";
import { cloudflareWorkersHost, CLOUDFLARE_ENV_TOKEN } from "../application";
import { createCloudflareScheduledHandler, compileCloudflareCrons } from "../scheduled";
import { MemoryExecutionStore } from "./fixtures/MemoryExecutionStore";

const event = { cron: "*/5 * * * *", scheduledTime: 1_800_000_000_000 };
const context = {
  waitUntil: (promise: Promise<unknown>) => {
    void promise.catch(() => {});
  },
};

describe("Cloudflare scheduled handler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(event.scheduledTime);
    Container.reset();
    MetadataStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  async function fixture(
    method: (env: unknown, input: unknown, context: TaskExecutionContext) => Promise<unknown>,
    timeout = 30_000,
    maxAttempts = 1,
    fixtureOptions: {
      store?: MemoryExecutionStore;
      applicationId?: string;
      providerTokenId?: string;
      sibling?: () => Promise<unknown>;
    } = {},
  ) {
    class Reports {
      constructor(private readonly env: unknown) {}
      @Cron("*/5 * * * *", { name: "reports" })
      @Task({ timeout, maxAttempts })
      run(input: unknown, task: TaskExecutionContext) {
        return method(this.env, input, task);
      }
      @Cron("*/5 * * * *", { name: "sibling", enabled: fixtureOptions.sibling !== undefined })
      sibling() {
        return fixtureOptions.sibling?.();
      }
    }
    const graph = defineGeneratedDiGraph({
      version: "croco.generated-di-graph.v1",
      graphId: "reports",
      compilerVersion: "fixture",
      inputHash: "reports-hash",
      providers: [
        {
          token: Reports,
          tokenId: fixtureOptions.providerTokenId ?? "reports",
          debugName: "Reports",
          scope: "request",
          dependencies: [{ token: CLOUDFLARE_ENV_TOKEN, tokenId: "env", parameterIndex: 0 }],
          factory: (resolver) => new Reports(resolver.get(CLOUDFLARE_ENV_TOKEN)),
          sourceLocation: { file: "reports.ts", line: 1, column: 1 },
        },
      ],
      roots: [Reports],
    });
    const env = { REPORT_BUCKET: "private-binding" };
    const runtime = createApplicationRuntime(
      defineCrocoApplication({ name: "reports", imports: [cloudflareWorkersHost(env)] }),
      graph,
    );
    await runtime.initialize();
    const store = fixtureOptions.store ?? new MemoryExecutionStore();
    const manager = new ExecutionManagerImpl(store, {
      clock: () => new Date(vi.getMockedSystemTime()?.getTime() ?? event.scheduledTime),
    });
    const options = {
      runtime,
      graph,
      manifest: compileCloudflareCrons(graph),
      env,
      applicationId: fixtureOptions.applicationId ?? "reports-app",
      executionManager: manager,
    };
    return { runtime, store, options, handler: createCloudflareScheduledHandler(options) };
  }

  it("resolves native bindings inside the application callback and reuses completed scheduled identity", async () => {
    const seen: unknown[] = [];
    const app = await fixture(async (env, input, task) => {
      seen.push({
        env,
        input,
        requestId: Context.getRequestId(),
        attempt: task.attempt,
        aborted: task.signal.aborted,
      });
      return "stored";
    });
    try {
      await app.handler(event, app.options.env, context);
      await app.handler({ ...event }, app.options.env, context);
      expect(seen).toEqual([
        {
          env: app.options.env,
          input: event,
          requestId: `cron:reports-app:${event.scheduledTime}`,
          attempt: 1,
          aborted: false,
        },
      ]);
      expect(await app.store.list()).toMatchObject([
        { status: "completed", attempts: 1, result: "stored" },
      ]);
      expect(Context.get()).toBeNull();
      await app.handler(
        { ...event, scheduledTime: event.scheduledTime + 300_000 },
        app.options.env,
        context,
      );
      expect(seen).toHaveLength(2);
    } finally {
      await app.runtime.dispose();
    }
  });

  it("keeps applications isolated and rejects foreign environments, unknown schedules and drift before effects", async () => {
    const calls = vi.fn(async () => undefined);
    const a = await fixture(calls);
    const b = await fixture(calls);
    try {
      await expect(a.handler(event, b.options.env, context)).rejects.toMatchObject({
        code: "CLOUDFLARE_CRON_ENV_MISMATCH",
      });
      await expect(
        a.handler({ ...event, cron: "0 1 * * *" }, a.options.env, context),
      ).rejects.toMatchObject({ code: "CLOUDFLARE_CRON_UNREGISTERED" });
      expect(() =>
        createCloudflareScheduledHandler({
          ...a.options,
          manifest: { ...a.options.manifest, graphInputHash: "stale" },
        }),
      ).toThrow("Regenerate");
      expect(() =>
        createCloudflareScheduledHandler({ ...a.options, executionManager: undefined }),
      ).toThrow("ExecutionManager");
      expect(calls).not.toHaveBeenCalled();
      await Promise.all([
        a.handler(event, a.options.env, context),
        b.handler(event, b.options.env, context),
      ]);
      expect(calls).toHaveBeenCalledTimes(2);
      await a.runtime.dispose();
      await expect(a.handler(event, a.options.env, context)).rejects.toThrow();
      await b.handler(
        { ...event, scheduledTime: event.scheduledTime + 300_000 },
        b.options.env,
        context,
      );
      expect(calls).toHaveBeenCalledTimes(3);
    } finally {
      await Promise.all([a.runtime.dispose(), b.runtime.dispose()]);
    }
  });

  it("preserves failed execution evidence without retrying a settled firing implicitly", async () => {
    const calls = vi.fn(async () => {
      throw ProblemFactory.badRequest("REPORT_INVALID", "Invalid report");
    });
    const app = await fixture(calls);
    try {
      await expect(app.handler(event, app.options.env, context)).rejects.toMatchObject({
        code: "REPORT_INVALID",
      });
      await expect(app.handler(event, app.options.env, context)).rejects.toThrow();
      expect(calls).toHaveBeenCalledOnce();
      expect(await app.store.list()).toMatchObject([
        { status: "failed", error: { code: "REPORT_INVALID" } },
      ]);
    } finally {
      await app.runtime.dispose();
    }
  });

  it("keeps a failed firing and waitUntil pending until every sibling settles", async () => {
    const failure = ProblemFactory.badRequest("REPORT_INVALID", "Invalid report");
    let release: (() => void) | undefined;
    let failedEntered: (() => void) | undefined;
    let siblingEntered: (() => void) | undefined;
    const started = Promise.all([
      new Promise<void>((resolve) => {
        failedEntered = resolve;
      }),
      new Promise<void>((resolve) => {
        siblingEntered = resolve;
      }),
    ]);
    const app = await fixture(
      async () => {
        failedEntered?.();
        throw failure;
      },
      30_000,
      1,
      {
        sibling: () =>
          new Promise<void>((resolve) => {
            release = resolve;
            siblingEntered?.();
          }),
      },
    );
    let handlerSettled = false;
    let hostSettled = false;
    let hostCompletion: Promise<unknown> | undefined;
    try {
      const pending = app.handler(event, app.options.env, {
        waitUntil: (promise) => {
          hostCompletion = promise;
          void promise.then(
            () => {
              hostSettled = true;
            },
            () => {
              hostSettled = true;
            },
          );
        },
      });
      const outcome = pending.then(
        () => {
          handlerSettled = true;
        },
        (error: unknown) => {
          handlerSettled = true;
          return error;
        },
      );
      await started;
      await vi.advanceTimersByTimeAsync(0);
      expect(await app.store.list()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "reports", status: "failed" }),
          expect.objectContaining({ type: "sibling", status: "running" }),
        ]),
      );
      expect(handlerSettled).toBe(false);
      expect(hostSettled).toBe(false);
      expect(release).toBeTypeOf("function");
      release?.();
      expect(await outcome).toBe(failure);
      await expect(hostCompletion).rejects.toBe(failure);
      expect(hostSettled).toBe(true);
      expect(await app.store.list()).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "sibling", status: "completed" })]),
      );
    } finally {
      release?.();
      await app.runtime.dispose();
    }
  });

  it("runs the same firing once per application in one shared execution store", async () => {
    const store = new MemoryExecutionStore();
    const calls = vi.fn(async () => "stored");
    const a = await fixture(calls, 30_000, 1, { store, applicationId: "app-a" });
    const b = await fixture(calls, 30_000, 1, { store, applicationId: "app-b" });
    try {
      await a.handler(event, a.options.env, context);
      await b.handler(event, b.options.env, context);
      await a.handler(event, a.options.env, context);
      await b.handler(event, b.options.env, context);
      expect(calls).toHaveBeenCalledTimes(2);
      expect(await store.list()).toHaveLength(2);
      expect((await store.list()).map(({ metadata }) => metadata?.applicationId).sort()).toEqual([
        "app-a",
        "app-b",
      ]);
    } finally {
      await Promise.all([a.runtime.dispose(), b.runtime.dispose()]);
    }
  });

  it("rejects recovery when a Cron name is reassigned to another provider", async () => {
    const original = await fixture(
      async () => {
        throw ProblemFactory.badRequest("REPORT_INVALID", "Invalid report");
      },
      30_000,
      2,
    );
    const replacementCalls = vi.fn(async () => "wrong effect");
    const replacement = await fixture(replacementCalls, 30_000, 2, {
      store: original.store,
      providerTokenId: "replacement-reports",
    });
    try {
      await expect(original.handler(event, original.options.env, context)).rejects.toThrow();
      const execution = (await original.store.list()).at(0);
      if (!execution) throw new Error("Missing failed execution");
      await expect(replacement.handler.retry(execution.id)).rejects.toMatchObject({
        code: "CLOUDFLARE_CRON_EXECUTION_MISMATCH",
      });
      expect(replacementCalls).not.toHaveBeenCalled();
      expect(await original.store.findById(execution.id)).toMatchObject({
        status: "failed",
        attempts: 1,
      });
    } finally {
      await Promise.all([original.runtime.dispose(), replacement.runtime.dispose()]);
    }
  });

  it.each(["cronMethodName", "cronProviderTokenId"])(
    "rejects changed or missing persisted %s before retry or timeout recovery mutates execution",
    async (field) => {
      const calls = vi.fn(async () => {
        throw ProblemFactory.badRequest("REPORT_INVALID", "Invalid report");
      });
      const app = await fixture(calls, 30_000, 2);
      try {
        await expect(app.handler(event, app.options.env, context)).rejects.toThrow();
        const execution = (await app.store.list()).at(0);
        if (!execution) throw new Error("Missing failed execution");
        expect(execution.metadata).toMatchObject({
          cronProviderTokenId: "reports",
          cronMethodName: "run",
        });
        const metadata = { ...execution.metadata };
        if (field === "cronMethodName") metadata[field] = "retiredMethod";
        else delete metadata[field];
        await app.store.update(execution.id, { metadata });
        await expect(app.handler.retry(execution.id)).rejects.toMatchObject({
          code: "CLOUDFLARE_CRON_EXECUTION_MISMATCH",
        });
        await expect(
          app.handler.recoverTimeout(execution.id, "Effects inspected"),
        ).rejects.toMatchObject({
          code: "CLOUDFLARE_CRON_EXECUTION_MISMATCH",
        });
        expect(calls).toHaveBeenCalledOnce();
        expect(await app.store.findById(execution.id)).toMatchObject({
          status: "failed",
          attempts: 1,
          metadata,
        });
      } finally {
        await app.runtime.dispose();
      }
    },
  );

  it("retries a named Cron execution with its original DI scope and rejects another application", async () => {
    const seen: unknown[] = [];
    const app = await fixture(
      async (env, input, task) => {
        seen.push({ env, input, attempt: task.attempt, requestId: Context.getRequestId() });
        if (task.attempt === 1) throw ProblemFactory.badRequest("REPORT_INVALID", "Invalid report");
        return "recovered";
      },
      30_000,
      2,
    );
    try {
      await expect(app.handler(event, app.options.env, context)).rejects.toThrow();
      const execution = (await app.store.list()).at(0);
      if (!execution) throw new Error("Missing failed execution");
      const foreign = createCloudflareScheduledHandler({
        ...app.options,
        applicationId: "other-app",
      });
      await expect(foreign.retry(execution.id)).rejects.toMatchObject({
        code: "CLOUDFLARE_CRON_EXECUTION_MISMATCH",
      });
      expect(await app.handler.retry(execution.id)).toBe("recovered");
      expect(seen).toEqual([
        {
          env: app.options.env,
          input: event,
          attempt: 1,
          requestId: `cron:reports-app:${event.scheduledTime}`,
        },
        {
          env: app.options.env,
          input: event,
          attempt: 2,
          requestId: `cron:reports-app:recovery:${execution.id}`,
        },
      ]);
      expect(await app.store.list()).toMatchObject([
        { status: "completed", attempts: 2, result: "recovered" },
      ]);
      expect(Context.get()).toBeNull();
      await app.runtime.dispose();
      await expect(app.handler.retry(execution.id)).rejects.toThrow();
    } finally {
      await app.runtime.dispose();
    }
  });

  it("recovers an indeterminate timeout through the same Cron registry after recording operator evidence", async () => {
    let entered: (() => void) | undefined;
    let release: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const app = await fixture(
      async (_env, _input, task) => {
        if (task.attempt === 1) {
          entered?.();
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return "late";
        }
        return "recovered";
      },
      25,
      2,
    );
    try {
      const rejected = expect(app.handler(event, app.options.env, context)).rejects.toMatchObject({
        code: "tasks-core/execution-timeout",
      });
      await started;
      await vi.advanceTimersByTimeAsync(25);
      await rejected;
      const execution = (await app.store.list()).at(0);
      if (!execution) throw new Error("Missing timed out execution");
      await expect(app.handler.retry(execution.id)).rejects.toMatchObject({
        code: "execution/indeterminate-retry-blocked",
      });
      expect(await app.handler.recoverTimeout(execution.id, "External effects inspected")).toBe(
        "recovered",
      );
      release?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(await app.store.list()).toMatchObject([
        {
          status: "completed",
          attempts: 2,
          result: "recovered",
          metadata: { timeoutRecovery: { reason: "External effects inspected" } },
        },
      ]);
    } finally {
      release?.();
      await app.runtime.dispose();
    }
  });

  it("admits one concurrent firing and preserves cancellation against a late handler result", async () => {
    let entered: (() => void) | undefined;
    let release: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const calls = vi.fn(async () => {
      entered?.();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return "late-result";
    });
    const app = await fixture(calls);
    try {
      const first = app.handler(event, app.options.env, context);
      const outcome = first.then(
        () => undefined,
        (failure: unknown) => failure,
      );
      await started;
      await expect(app.handler(event, app.options.env, context)).rejects.toThrow();
      expect(calls).toHaveBeenCalledOnce();
      const execution = (await app.store.list()).at(0);
      if (!execution) throw new Error("Missing running execution");
      await app.options.executionManager.cancel(execution.id);
      release?.();
      expect(await outcome).toBeDefined();
      expect(await app.store.list()).toMatchObject([{ status: "cancelled" }]);
      await expect(app.handler(event, app.options.env, context)).rejects.toThrow();
      expect(calls).toHaveBeenCalledOnce();
    } finally {
      release?.();
      await app.runtime.dispose();
    }
  });

  it("uses task timeout fencing and cooperative abort without recording late success", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(event.scheduledTime);
    let entered: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let signal: AbortSignal | undefined;
    let release: (() => void) | undefined;
    const app = await fixture(async (_env, _input, task) => {
      signal = task.signal;
      entered?.();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return "late";
    }, 25);
    try {
      const pending = app.handler(event, app.options.env, context);
      const rejected = expect(pending).rejects.toMatchObject({
        code: "tasks-core/execution-timeout",
      });
      await started;
      await vi.advanceTimersByTimeAsync(25);
      await rejected;
      expect(signal?.aborted).toBe(true);
      expect(await app.store.list()).toMatchObject([{ status: "timed_out" }]);
      release?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(await app.store.list()).toMatchObject([{ status: "timed_out" }]);
    } finally {
      release?.();
      vi.useRealTimers();
      await app.runtime.dispose();
    }
  });
});
