import { describe, expect, it } from "vitest";
import {
  declareSecurityMiddlewareCapabilities,
  getSecurityMiddlewareCapabilities,
  hasSecurityMiddlewareCapability,
  type MiddlewareFunction,
  type SecurityMiddlewareCapability,
} from "../index";

function createMiddleware(): MiddlewareFunction {
  return async (_context, next) => {
    await next();
  };
}

describe("transports-http behavioral evidence", () => {
  it("declares and reads public HTTP middleware capabilities deterministically", () => {
    const middleware = declareSecurityMiddlewareCapabilities(createMiddleware(), [
      "cors",
      "security-headers",
      "cors",
    ]);

    expect(getSecurityMiddlewareCapabilities(middleware)).toEqual(["security-headers", "cors"]);
  });

  it("rejects an unsupported public HTTP middleware capability with a stable diagnostic", () => {
    expect(() =>
      hasSecurityMiddlewareCapability(
        createMiddleware(),
        "unsupported" as SecurityMiddlewareCapability,
      ),
    ).toThrow("Unsupported security middleware capability: unsupported");
  });
});
