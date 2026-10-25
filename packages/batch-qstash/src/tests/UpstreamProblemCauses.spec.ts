import { describe, expect, it } from "vitest";
import { QStashBatchPublishProblem } from "../libs/problems/QStashBatchProblems";

describe("Upstream Problem causes", () => {
  it("retains QStashBatchPublishProblem Error causes without serializing them", () => {
    const upstream = Object.assign(new Error("provider failed token=super-secret-token"), {
      secret: "private-upstream-value",
    });
    const problem = new QStashBatchPublishProblem("publish", upstream);
    expect(problem.cause).toBeInstanceOf(Error);
    expect(problem.cause?.message).toContain("provider failed");
    expect(problem.cause?.message).not.toContain("super-secret-token");
    expect(problem.cause?.stack).not.toContain("super-secret-token");
    expect(problem.cause).not.toHaveProperty("secret");
    expect(Object.getOwnPropertyDescriptor(problem, "cause")?.enumerable).toBe(false);
    expect(JSON.stringify(problem)).not.toContain("private-upstream-value");
    expect(problem.toJSON()).not.toHaveProperty("cause");
    expect(new QStashBatchPublishProblem("publish", "upstream failure").cause).toBeUndefined();
  });
});
