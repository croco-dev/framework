import { describe, expect, it } from "vitest";
import {
  createNotificationPreferenceEvaluationKey,
  createNotificationPreferenceContextFixture,
  NotificationPreferenceEvaluator,
} from "../libs/NotificationPreferences";
import { NotificationChannel } from "../libs/types";

const context = {
  tenantId: "tenant-1",
  userId: "user-1",
  channel: NotificationChannel.EMAIL,
  topic: "billing.invoice-ready",
};

describe("NotificationPreferenceEvaluator", () => {
  it("should produce a deterministic default allow decision", () => {
    const evaluator = new NotificationPreferenceEvaluator();

    expect(evaluator.evaluate(context)).toEqual({
      allowed: true,
      context,
      reason: "default-allow",
      evaluationKey: createNotificationPreferenceEvaluationKey(context),
    });
  });

  it("should choose the most specific matching rule before a broader tenant rule", () => {
    const evaluator = new NotificationPreferenceEvaluator({
      rules: [
        {
          id: "tenant-allow",
          tenantId: "tenant-1",
          enabled: true,
        },
        {
          id: "user-topic-deny",
          tenantId: "tenant-1",
          userId: "user-1",
          channel: NotificationChannel.EMAIL,
          topic: "billing.invoice-ready",
          enabled: false,
          reason: "user-opted-out",
        },
      ],
    });

    expect(evaluator.evaluate(context)).toMatchObject({
      allowed: false,
      reason: "user-opted-out",
      ruleId: "user-topic-deny",
    });
  });

  it("should break equal-specificity rule ties by stable id instead of input order", () => {
    const firstEvaluator = new NotificationPreferenceEvaluator({
      rules: [
        {
          id: "b-deny",
          tenantId: "tenant-1",
          topic: "billing.invoice-ready",
          enabled: false,
        },
        {
          id: "a-allow",
          tenantId: "tenant-1",
          topic: "billing.invoice-ready",
          enabled: true,
        },
      ],
    });
    const secondEvaluator = new NotificationPreferenceEvaluator({
      rules: [
        {
          id: "a-allow",
          tenantId: "tenant-1",
          topic: "billing.invoice-ready",
          enabled: true,
        },
        {
          id: "b-deny",
          tenantId: "tenant-1",
          topic: "billing.invoice-ready",
          enabled: false,
        },
      ],
    });

    expect(firstEvaluator.evaluate(context)).toMatchObject({
      allowed: true,
      ruleId: "a-allow",
    });
    expect(secondEvaluator.evaluate(context)).toEqual(firstEvaluator.evaluate(context));
  });

  it("should create preference context fixtures with deterministic defaults", () => {
    expect(
      createNotificationPreferenceContextFixture({
        tenantId: "tenant-1",
        topic: "billing.invoice-ready",
      }),
    ).toEqual({
      tenantId: "tenant-1",
      userId: "fixture-user",
      channel: NotificationChannel.EMAIL,
      topic: "billing.invoice-ready",
    });
  });
});
