import { describe, expect, it } from "vitest";
import { RedisProblem } from "../libs/problems/RedisProblem";

describe("Upstream Problem causes", () => {
  it("retains RedisProblem Error causes without serializing them", () => {
    const upstream = Object.assign(new Error("provider failed"), {
      secret: "private-upstream-value",
    });
    const problem = new RedisProblem("read", upstream);
    expect(problem.cause).toBe(upstream);
    expect(Object.getOwnPropertyDescriptor(problem, "cause")?.enumerable).toBe(false);
    expect(JSON.stringify(problem)).not.toContain("private-upstream-value");
    expect(problem.toJSON()).not.toHaveProperty("cause");
    expect(new RedisProblem("read", "upstream failure").cause).toBeUndefined();
  });
});
