import type { RequestContext } from "@croco/framework-context";
import { Container, Context } from "@croco/framework-context";
import { ProblemCategory } from "@croco/problems-core";
import { beforeEach, describe, expect, it } from "vitest";
import { BlockDuringImpersonation } from "../libs/decorators/BlockDuringImpersonation";
import type { ImpersonationContext } from "../libs/ImpersonationService";
import { BlockedDuringImpersonationProblem } from "../libs/problems/ImpersonationProblems";
import type { ImpersonationConfig } from "../libs/types";
import { IMPERSONATION_CONFIG_TOKEN } from "../libs/types";

describe("BlockDuringImpersonation", () => {
  class TestService {
    @BlockDuringImpersonation()
    sensitiveOperation(): string {
      return "success";
    }

    @BlockDuringImpersonation()
    allowedOperation(): string {
      return "allowed";
    }
  }

  const createImpersonationContext = (): ImpersonationContext => {
    const now = Date.now();
    return {
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
  };

  const setConfig = (blockedActions: string[]): void => {
    const config: ImpersonationConfig = {
      maxDurationMs: 30 * 60 * 1000,
      requireReason: false,
      blockedActions,
    };
    Container.set(IMPERSONATION_CONFIG_TOKEN, config);
  };

  beforeEach(() => {
    Container.reset();
  });

  it("should allow execution when not impersonating", async () => {
    const service = new TestService();
    const result = await Context.run({ requestId: "req-1", user: { id: "user-1" } }, async () => {
      return service.sensitiveOperation();
    });
    expect(result).toBe("success");
  });

  it("denies a configured action and allows an unlisted action during impersonation", async () => {
    const service = new TestService();
    setConfig(["sensitiveOperation"]);

    await expect(
      Context.run(createImpersonationContext(), async () => {
        return service.sensitiveOperation();
      }),
    ).rejects.toMatchObject({
      code: "BLOCKED_DURING_IMPERSONATION",
      category: ProblemCategory.Forbidden,
    });

    await expect(
      Context.run(createImpersonationContext(), async () => service.allowedOperation()),
    ).resolves.toBe("allowed");
  });

  it("fails with a stable diagnostic when enforcement configuration is missing", async () => {
    const service = new TestService();

    await expect(
      Context.run(createImpersonationContext(), async () => service.sensitiveOperation()),
    ).rejects.toMatchObject({
      code: "IMPERSONATION_CONFIGURATION_INVALID",
      category: ProblemCategory.InternalServerError,
      field: "configuration",
      constraint: "registered",
      receivedValue: "missing",
    });
  });

  it.each([
    {
      blockedActions: ["sensitive Operation"],
      constraint: "normalized-action-identifiers",
      receivedValue: "invalid-item-at-index-0",
    },
    {
      blockedActions: ["sensitiveOperation", "sensitiveOperation"],
      constraint: "unique-action-identifiers",
      receivedValue: "duplicate-item-at-index-1",
    },
  ])("fails closed for invalid action configuration %#", async (invalidConfig) => {
    const service = new TestService();
    setConfig(invalidConfig.blockedActions);

    await expect(
      Context.run(createImpersonationContext(), async () => service.sensitiveOperation()),
    ).rejects.toMatchObject({
      code: "IMPERSONATION_CONFIGURATION_INVALID",
      field: "blockedActions",
      constraint: invalidConfig.constraint,
      receivedValue: invalidConfig.receivedValue,
    });
  });

  it("fails closed when requireReason is not boolean", async () => {
    const service = new TestService();
    Container.set(IMPERSONATION_CONFIG_TOKEN, {
      maxDurationMs: 30 * 60 * 1000,
      requireReason: 0 as unknown as boolean,
      blockedActions: ["sensitiveOperation"],
    });

    await expect(
      Context.run(createImpersonationContext(), async () => service.sensitiveOperation()),
    ).rejects.toMatchObject({
      code: "IMPERSONATION_CONFIGURATION_INVALID",
      field: "requireReason",
      constraint: "boolean",
      receivedValue: "non-boolean-number",
    });
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
  ])("should fail closed for %s", async (_description, impersonation) => {
    const service = new TestService();
    await expect(
      Context.run({ requestId: "req-1", impersonation } as RequestContext, async () =>
        service.sensitiveOperation(),
      ),
    ).rejects.toThrow(BlockedDuringImpersonationProblem);
  });

  it("should fail closed when the context accessor throws", async () => {
    const service = new TestService();
    const context = Object.defineProperty({ requestId: "req-1" }, "impersonation", {
      get: () => {
        throw new Error("untrusted context accessor");
      },
    }) as RequestContext;

    await expect(Context.run(context, async () => service.sensitiveOperation())).rejects.toThrow(
      BlockedDuringImpersonationProblem,
    );
  });

  it("should allow execution when the impersonation marker is absent", async () => {
    const service = new TestService();
    await expect(
      Context.run({ requestId: "req-1" }, async () => service.sensitiveOperation()),
    ).resolves.toBe("success");
  });
});
