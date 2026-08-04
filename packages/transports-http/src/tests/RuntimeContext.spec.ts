import { describe, expect, it, vi } from "vitest";

import {
  createRuntimeContext,
  RuntimeCapabilityProblem,
  type RuntimeContextInit,
} from "../libs/runtimeContext";

const validLambdaRuntimeContext: RuntimeContextInit<"lambda"> = {
  platform: "lambda",
  env: {},
  waitUntil: () => undefined,
  flush: async () => undefined,
  capabilities: {
    waitUntil: true,
    flush: true,
    shutdown: false,
  },
};

const unsupportedWorkersFlush: RuntimeContextInit<"cloudflare-workers"> = {
  platform: "cloudflare-workers",
  env: {},
  waitUntil: () => undefined,
  capabilities: {
    // @ts-expect-error Cloudflare Workers do not support Croco runtime flush.
    flush: true,
  },
};

const unsupportedNodeWaitUntil: RuntimeContextInit<"node"> = {
  platform: "node",
  env: {},
  // @ts-expect-error Node HTTP request contexts do not own waitUntil.
  waitUntil: () => undefined,
};

// @ts-expect-error Lambda flush capability requires a concrete flush hook.
const unsupportedLambdaFlushWithoutHook: RuntimeContextInit<"lambda"> = {
  platform: "lambda",
  env: {},
  waitUntil: () => undefined,
  capabilities: {
    flush: true,
  },
};

// @ts-expect-error Custom runtime platforms must provide an explicit capability support config.
const unsupportedCustomRuntimeWithoutSupport: RuntimeContextInit<"edge-runtime"> = {
  platform: "edge-runtime",
  env: {},
};

describe("RuntimeContext", () => {
  it("exposes the concrete abort signal and derives its capability", () => {
    const controller = new AbortController();
    const runtime = createRuntimeContext({
      platform: "node",
      abortSignal: controller.signal,
      env: {},
    });
    const signal = runtime.abortSignal;

    expect(signal).toBe(controller.signal);
    expect(runtime.capabilities.abortSignal).toBe(true);

    controller.abort();

    expect(signal?.aborted).toBe(true);
  });

  it("reports abort signals as unsupported when no implementation is provided", () => {
    const runtime = createRuntimeContext({
      platform: "node",
      env: {},
    });

    expect(runtime.abortSignal).toBeUndefined();
    expect(runtime.capabilities.abortSignal).toBe(false);
  });

  it("accepts supported Lambda runtime capabilities", async () => {
    const runtime = createRuntimeContext(validLambdaRuntimeContext);

    runtime.waitUntil(Promise.resolve());
    await runtime.flush();

    expect(runtime.capabilities).toMatchObject({
      env: true,
      filesystem: true,
      nodeApi: true,
      requestLifecycle: true,
      waitUntil: true,
      flush: true,
      streamingResponse: false,
      deadline: true,
      abortSignal: false,
      shutdown: false,
    });
  });

  it("rejects unsupported capabilities after type erasure", () => {
    expect(() =>
      createRuntimeContext({
        platform: "cloudflare-workers",
        env: {},
        capabilities: {
          flush: true,
        },
      } as unknown as RuntimeContextInit),
    ).toThrow(RuntimeCapabilityProblem);
    try {
      createRuntimeContext({
        platform: "cloudflare-workers",
        env: {},
        capabilities: {
          flush: true,
        },
      } as unknown as RuntimeContextInit);
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeCapabilityProblem);
      expect((error as RuntimeCapabilityProblem).extensions).toMatchObject({
        diagnosticCode: "CROCO_RUNTIME_CAPABILITY_001",
        platform: "cloudflare-workers",
        capability: "flush",
      });
    }
  });

  it("rejects unsupported hooks after type erasure", () => {
    expect(() =>
      createRuntimeContext({
        platform: "node",
        env: {},
        waitUntil: () => undefined,
        capabilities: {
          waitUntil: false,
        },
      } as unknown as RuntimeContextInit),
    ).toThrow(RuntimeCapabilityProblem);
  });

  it("rejects abort signals on unsupported runtimes after type erasure", () => {
    expect(() =>
      createRuntimeContext({
        platform: "lambda",
        abortSignal: new AbortController().signal,
        env: {},
        waitUntil: () => undefined,
      } as unknown as RuntimeContextInit),
    ).toThrow(RuntimeCapabilityProblem);
  });

  it("rejects supported capabilities declared without an implementation", () => {
    expect(() =>
      createRuntimeContext({
        platform: "lambda",
        env: {},
        waitUntil: () => undefined,
        capabilities: {
          flush: true,
        },
      } as unknown as RuntimeContextInit),
    ).toThrow(RuntimeCapabilityProblem);
  });

  it("accepts custom runtime platforms with explicit capability support", async () => {
    const shutdown = vi.fn();
    const runtime = createRuntimeContext({
      platform: "edge-runtime",
      capabilitySupport: {
        env: true,
        filesystem: false,
        logger: false,
        nodeApi: false,
        requestLifecycle: true,
        trace: false,
        waitUntil: false,
        flush: true,
        streamingResponse: false,
        deadline: false,
        abortSignal: false,
        shutdown: true,
      },
      env: {},
      flush: async () => undefined,
      shutdown,
      capabilities: {
        flush: true,
        shutdown: true,
      },
    });

    await runtime.flush();
    await runtime.shutdown();

    expect(runtime.platform).toBe("edge-runtime");
    expect(runtime.capabilities.filesystem).toBe(false);
    expect(runtime.capabilities.requestLifecycle).toBe(true);
    expect(runtime.capabilities.flush).toBe(true);
    expect(runtime.capabilities.streamingResponse).toBe(false);
    expect(shutdown).toHaveBeenCalledOnce();
  });

  it("rejects custom runtime platforms without explicit capability support after type erasure", () => {
    expect(() =>
      createRuntimeContext({
        platform: "edge-runtime",
        env: {},
      } as unknown as RuntimeContextInit),
    ).toThrow(RuntimeCapabilityProblem);
  });
});
