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
  it("accepts supported Lambda runtime capabilities", async () => {
    const runtime = createRuntimeContext(validLambdaRuntimeContext);

    runtime.waitUntil(Promise.resolve());
    await runtime.flush();

    expect(runtime.capabilities).toMatchObject({
      env: true,
      waitUntil: true,
      flush: true,
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
        logger: false,
        trace: false,
        waitUntil: false,
        flush: true,
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
    expect(runtime.capabilities.flush).toBe(true);
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
