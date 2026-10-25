import { describe, expect, it } from "vitest";
import { QStashTaskPublishProblem } from "../libs/problems/QStashTaskProblems";

describe("Upstream Problem causes", () => {
  it("retains QStashTaskPublishProblem Error causes without serializing them", () => {
    const upstream = Object.assign(new Error("provider failed token=super-secret-token"), {
      secret: "private-upstream-value",
    });
    const problem = new QStashTaskPublishProblem(upstream);
    expect(problem.cause).toBeInstanceOf(Error);
    expect(problem.cause?.message).toContain("provider failed");
    expect(problem.cause?.message).not.toContain("super-secret-token");
    expect(problem.cause?.stack).not.toContain("super-secret-token");
    expect(problem.cause).not.toHaveProperty("secret");
    expect(Object.getOwnPropertyDescriptor(problem, "cause")?.enumerable).toBe(false);
    expect(JSON.stringify(problem)).not.toContain("private-upstream-value");
    expect(problem.toJSON()).not.toHaveProperty("cause");
    expect(new QStashTaskPublishProblem("upstream failure").cause).toBeUndefined();
  });
});
