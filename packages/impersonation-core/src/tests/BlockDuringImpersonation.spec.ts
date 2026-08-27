import type { RequestContext } from "@croco/framework-context";
import { Context } from "@croco/framework-context";
import { describe, expect, it } from "vitest";
import { BlockDuringImpersonation } from "../libs/decorators/BlockDuringImpersonation";
import type { ImpersonationContext } from "../libs/ImpersonationService";
import { BlockedDuringImpersonationProblem } from "../libs/problems/ImpersonationProblems";

describe("BlockDuringImpersonation", () => {
  class TestService {
    @BlockDuringImpersonation()
    sensitiveOperation(): string {
      return "success";
    }
  }

  it("should allow execution when not impersonating", async () => {
    const service = new TestService();
    const result = await Context.run({ requestId: "req-1", user: { id: "user-1" } }, async () => {
      return service.sensitiveOperation();
    });
    expect(result).toBe("success");
  });

  it("should throw BlockedDuringImpersonationProblem when impersonating", async () => {
    const service = new TestService();
    const now = Date.now();
    const impersonationContext = {
      requestId: "req-1",
      user: { id: "user-1" },
      impersonation: {
        sessionId: "imp_123",
        impersonatorId: "admin-1",
        targetUserId: "user-1",
        startedAt: new Date(now - 1_000),
        expiresAt: new Date(now + 60_000),
      },
    } as ImpersonationContext;

    await expect(
      Context.run(impersonationContext, async () => {
        return service.sensitiveOperation();
      }),
    ).rejects.toThrow(BlockedDuringImpersonationProblem);
  });

  it.each([
    ["a truthy non-object", true],
    ["a partial object", { sessionId: "imp_123" }],
    [
      "an invalid date",
      {
        sessionId: "imp_123",
        impersonatorId: "admin-1",
        targetUserId: "user-1",
        startedAt: new Date("invalid"),
        expiresAt: new Date(Date.now() + 60_000),
      },
    ],
    [
      "a future session",
      {
        sessionId: "imp_123",
        impersonatorId: "admin-1",
        targetUserId: "user-1",
        startedAt: new Date(Date.now() + 60_000),
        expiresAt: new Date(Date.now() + 120_000),
      },
    ],
    [
      "an expired session",
      {
        sessionId: "imp_123",
        impersonatorId: "admin-1",
        targetUserId: "user-1",
        startedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() - 1),
      },
    ],
  ])("should allow execution for %s", async (_description, impersonation) => {
    const service = new TestService();
    const result = await Context.run(
      { requestId: "req-1", impersonation } as RequestContext,
      async () => service.sensitiveOperation(),
    );

    expect(result).toBe("success");
  });

  it("should allow execution when the context accessor throws", async () => {
    const service = new TestService();
    const context = Object.defineProperty({ requestId: "req-1" }, "impersonation", {
      get: () => {
        throw new Error("untrusted context accessor");
      },
    }) as RequestContext;

    await expect(Context.run(context, async () => service.sensitiveOperation())).resolves.toBe(
      "success",
    );
  });
});
