import type { Problem } from "@croco/problems-core";
import { describe, expect, expectTypeOf, it } from "vitest";
import { NotificationDeliveryFailedProblem } from "../libs/problems/NotificationProblems";
import type { NotificationResult } from "../libs/types";

type SuccessfulNotificationResult = Extract<NotificationResult, { success: true }>;
type FailedNotificationResult = Extract<NotificationResult, { success: false }>;

describe("NotificationResult", () => {
  it("exposes delivery evidence only on success", () => {
    expectTypeOf<SuccessfulNotificationResult>().toEqualTypeOf<{
      success: true;
      messageId?: string;
      providerResponse?: unknown;
      problem?: never;
      error?: never;
    }>();

    const result: NotificationResult = {
      success: true,
      messageId: "message-1",
      providerResponse: { accepted: true },
    };

    expect(result.messageId).toBe("message-1");
  });

  it("requires a Problem on failure and excludes success-only evidence", () => {
    expectTypeOf<FailedNotificationResult>().toEqualTypeOf<{
      success: false;
      problem: Problem;
      providerResponse?: unknown;
      messageId?: never;
      error?: never;
    }>();

    const problem = new NotificationDeliveryFailedProblem("provider");
    const result: NotificationResult = {
      success: false,
      problem,
      providerResponse: { status: 503 },
    };

    expect(result.problem).toBe(problem);
  });

  it("rejects contradictory and legacy result fields from pre-built objects", () => {
    const problem = new NotificationDeliveryFailedProblem("provider");
    const successWithProblem = { success: true, problem } as const;
    const failureWithMessageId = { success: false, problem, messageId: "message-1" } as const;
    const legacyFailure = { success: false, problem, error: new Error("legacy") } as const;

    // @ts-expect-error A successful result cannot carry failure evidence.
    const invalidSuccess: NotificationResult = successWithProblem;
    // @ts-expect-error A failed result cannot carry success-only delivery evidence.
    const invalidFailure: NotificationResult = failureWithMessageId;
    // @ts-expect-error The legacy error field is not part of either result branch.
    const invalidLegacyFailure: NotificationResult = legacyFailure;

    expect([invalidSuccess, invalidFailure, invalidLegacyFailure]).toHaveLength(3);
  });
});
