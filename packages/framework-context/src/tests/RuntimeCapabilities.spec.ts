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
      "logger",
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
        logger: false,
        trace: false,
        waitUntil: false,
        flush: true,
        shutdown: false,
      }),
    ).toBe(true);
  });
});
