import { describe, expect, it } from "vitest";

import {
  getRuntimeCapabilitySupport,
  isRuntimeCapabilitySupported,
  RUNTIME_CAPABILITY_NAMES,
  RUNTIME_CAPABILITY_SUPPORT,
  RUNTIME_PLATFORMS,
} from "../index";

describe("runtime capabilities", () => {
  it("exposes the shared runtime and capability vocabulary", () => {
    expect(RUNTIME_PLATFORMS).toEqual(["node", "lambda", "cloudflare-workers"]);
    expect(RUNTIME_CAPABILITY_NAMES).toEqual([
      "env",
      "filesystem",
      "logger",
      "nodeApi",
      "requestLifecycle",
      "trace",
      "waitUntil",
      "flush",
      "shutdown",
    ]);
  });

  it("marks flush as Lambda-only in the shared support matrix", () => {
    expect(RUNTIME_CAPABILITY_SUPPORT.lambda.flush).toBe(true);
    expect(getRuntimeCapabilitySupport("cloudflare-workers").flush).toBe(false);
    expect(isRuntimeCapabilitySupported("node", "flush")).toBe(false);
    expect(
      isRuntimeCapabilitySupported("edge-runtime", "flush", {
        env: true,
        filesystem: false,
        logger: false,
        nodeApi: false,
        requestLifecycle: true,
        trace: false,
        waitUntil: false,
        flush: true,
        shutdown: false,
      }),
    ).toBe(true);
  });

  it("marks Node-only platform APIs separately from request lifecycle support", () => {
    expect(RUNTIME_CAPABILITY_SUPPORT.node.filesystem).toBe(true);
    expect(RUNTIME_CAPABILITY_SUPPORT.node.nodeApi).toBe(true);
    expect(RUNTIME_CAPABILITY_SUPPORT.lambda.filesystem).toBe(true);
    expect(RUNTIME_CAPABILITY_SUPPORT.lambda.nodeApi).toBe(true);
    expect(RUNTIME_CAPABILITY_SUPPORT["cloudflare-workers"].filesystem).toBe(false);
    expect(RUNTIME_CAPABILITY_SUPPORT["cloudflare-workers"].nodeApi).toBe(false);
    expect(RUNTIME_CAPABILITY_SUPPORT["cloudflare-workers"].requestLifecycle).toBe(true);
  });
});
