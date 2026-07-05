import { describe, expect, it } from "vitest";
import {
  declareSecurityMiddlewareCapabilities,
  getSecurityMiddlewareCapabilities,
  hasSecurityMiddlewareCapability,
  type SecurityMiddlewareCapability,
} from "../libs/middleware/SecurityMiddlewareMarker";
import type { MiddlewareFunction } from "../libs/types";

function createMiddleware(): MiddlewareFunction {
  return async (_ctx, next) => {
    await next();
  };
}

describe("SecurityMiddlewareMarker", () => {
  it("should declare capabilities additively with deterministic de-duplication", () => {
    const middleware = createMiddleware();

    declareSecurityMiddlewareCapabilities(middleware, ["cors", "cors"]);
    declareSecurityMiddlewareCapabilities(middleware, ["security-headers"]);

    expect(getSecurityMiddlewareCapabilities(middleware)).toEqual(["security-headers", "cors"]);
    expect(hasSecurityMiddlewareCapability(middleware, "security-headers")).toBe(true);
    expect(hasSecurityMiddlewareCapability(middleware, "body-limit")).toBe(false);
  });

  it("should return an immutable capability copy", () => {
    const middleware = declareSecurityMiddlewareCapabilities(createMiddleware(), ["body-limit"]);
    const capabilities = getSecurityMiddlewareCapabilities(middleware);

    expect(Object.isFrozen(capabilities)).toBe(true);
    expect(() => {
      (capabilities as SecurityMiddlewareCapability[]).push("rate-limit");
    }).toThrow(TypeError);
    expect(getSecurityMiddlewareCapabilities(middleware)).toEqual(["body-limit"]);
  });

  it("should store marker metadata as non-enumerable function metadata", () => {
    const middleware = declareSecurityMiddlewareCapabilities(createMiddleware(), ["rate-limit"]);

    expect(Object.keys(middleware)).toEqual([]);
  });

  it("should reject unsupported runtime capability values", () => {
    const middleware = createMiddleware();

    let error: unknown;
    try {
      declareSecurityMiddlewareCapabilities(middleware, [
        "unsafe-source-match" as SecurityMiddlewareCapability,
      ]);
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: "CROCO_HTTP_SECURITY_002",
      extensions: {
        capability: "unsafe-source-match",
      },
    });
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "Unsupported security middleware capability: unsafe-source-match",
    );
    expect(getSecurityMiddlewareCapabilities(middleware)).toEqual([]);
  });

  it("should reject unsupported runtime capability checks", () => {
    const middleware = createMiddleware();

    let error: unknown;
    try {
      hasSecurityMiddlewareCapability(
        middleware,
        "unsafe-source-match" as SecurityMiddlewareCapability,
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: "CROCO_HTTP_SECURITY_002",
      extensions: {
        capability: "unsafe-source-match",
      },
    });
    expect(error).toBeInstanceOf(Error);
  });

  it("should let wrappers copy declared capabilities from wrapped middleware", () => {
    const wrapped = declareSecurityMiddlewareCapabilities(createMiddleware(), [
      "body-limit",
      "rate-limit",
    ]);
    const wrapper: MiddlewareFunction = async (ctx, next) => wrapped(ctx, next);

    declareSecurityMiddlewareCapabilities(wrapper, getSecurityMiddlewareCapabilities(wrapped));

    expect(getSecurityMiddlewareCapabilities(wrapper)).toEqual(["body-limit", "rate-limit"]);
  });
});
