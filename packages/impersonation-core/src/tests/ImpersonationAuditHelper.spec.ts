import { describe, expect, it } from "vitest";
import { withImpersonationAudit } from "../libs/ImpersonationAuditHelper";
import type { ImpersonationContext } from "../libs/ImpersonationService";

describe("withImpersonationAudit", () => {
  it("should add impersonatorId when impersonation context exists", () => {
    const metadata = { action: "sensitive" };
    const now = Date.now();
    const context = {
      impersonation: {
        sessionId: "imp_123",
        impersonatorId: "admin-1",
        targetUserId: "user-1",
        startedAt: new Date(now - 1_000),
        expiresAt: new Date(now + 60_000),
      },
    } as ImpersonationContext;
    const result = withImpersonationAudit(metadata, context);
    expect(result).toHaveProperty("impersonatorId", "admin-1");
    expect(result).toHaveProperty("impersonationSessionId", "imp_123");
  });

  it("should return unchanged metadata when no impersonation context", () => {
    const metadata = { action: "normal" };
    const context = { user: { id: "user-1" } };
    const result = withImpersonationAudit(metadata, context);
    expect(result).toEqual(metadata);
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
  ])("should preserve metadata for %s", (_description, impersonation) => {
    const metadata = { action: "normal" };

    expect(withImpersonationAudit(metadata, { impersonation })).toBe(metadata);
  });

  it("should preserve metadata when the context accessor throws", () => {
    const metadata = { action: "normal" };
    const context = Object.defineProperty({}, "impersonation", {
      get: () => {
        throw new Error("untrusted context accessor");
      },
    });

    expect(withImpersonationAudit(metadata, context)).toBe(metadata);
  });
});
