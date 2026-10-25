import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { BetterAuthAuthenticationProblem } from "../libs/problems/BetterAuthAuthenticationProblem";

describe("Upstream Problem causes", () => {
  it("retains BetterAuthAuthenticationProblem Error causes without serializing them", () => {
    const upstream = Object.assign(new Error("provider failed token=super-secret-token"), {
      secret: "private-upstream-value",
    });
    const problem = new BetterAuthAuthenticationProblem("authenticate", upstream);
    expect(problem.cause).toBeInstanceOf(Error);
    expect(problem.cause?.message).toContain("provider failed");
    expect(problem.cause?.message).not.toContain("super-secret-token");
    expect(problem.cause?.stack).not.toContain("super-secret-token");
    expect(problem.cause).not.toHaveProperty("secret");
    expect(Object.getOwnPropertyDescriptor(problem, "cause")?.enumerable).toBe(false);
    expect(JSON.stringify(problem)).not.toContain("private-upstream-value");
    expect(problem.toJSON()).not.toHaveProperty("cause");
    expect(
      new BetterAuthAuthenticationProblem("authenticate", "upstream failure").cause,
    ).toBeUndefined();
  });
  it.each(["revokeSession", "revokeUserSessions"] as const)(
    "suppresses echoed credentials in %s Error causes and inspection",
    (operation) => {
      for (const message of [
        "upstream echoed session-token-123",
        "authorization: Bearer authorization-session-token",
      ]) {
        const problem = new BetterAuthAuthenticationProblem(operation, new Error(message));
        expect(problem.cause).toBeInstanceOf(Error);
        expect(problem.cause?.message).toBe("upstream revocation failed");
        for (const rendered of [
          problem.message,
          problem.cause?.stack,
          inspect(problem),
          JSON.stringify(problem),
        ]) {
          expect(rendered).not.toContain("session-token-123");
          expect(rendered).not.toContain("authorization-session-token");
        }
      }
    },
  );

  it.each(["authenticate", "readiness"] as const)(
    "redacts complete authorization values for %s",
    (operation) => {
      const problem = new BetterAuthAuthenticationProblem(
        operation,
        new Error("authorization: Bearer bearer-credential"),
      );
      for (const rendered of [
        problem.message,
        problem.cause?.message,
        problem.cause?.stack,
        inspect(problem),
        JSON.stringify(problem),
      ]) {
        expect(rendered).not.toContain("bearer-credential");
      }
    },
  );
});
