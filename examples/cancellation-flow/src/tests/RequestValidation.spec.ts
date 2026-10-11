import { describe, expect, it } from "vitest";
import { CancellationInputProblem } from "@croco/billing-core/cancellation";
import { parseDecision, parsePolicyEdit } from "../requestValidation";

describe("Cancellation API request boundary", () => {
  it.each([
    null,
    [],
    { decisionId: "d", kind: "unknown" },
    { decisionId: "d", kind: "keep_subscription", reason: 5 },
  ])("rejects malformed decisions as a stable Problem", (value) => {
    expect(() => parseDecision(value)).toThrow(CancellationInputProblem);
  });
  it("takes ownership and actors only from server context", () => {
    expect(
      parseDecision({
        decisionId: "d",
        kind: "continue_cancel",
        tenantId: "forged",
        subject: "foreign",
      }),
    ).toEqual({ decisionId: "d", kind: "continue_cancel" });
    expect(
      parsePolicyEdit({
        entries: [],
        reason: "Terms reviewed",
        expectedRevision: 0,
        idempotencyKey: "edit",
        actor: "forged",
      }),
    ).not.toHaveProperty("actor");
  });
  it.each([
    null,
    { entries: [null], reason: "r", expectedRevision: 0, idempotencyKey: "k" },
    {
      entries: [
        {
          choiceId: "c",
          label: "Choice",
          order: 0,
          enabled: true,
          billingPeriods: ["invented"],
          refundKinds: ["none"],
        },
      ],
      reason: "r",
      expectedRevision: 0,
      idempotencyKey: "k",
    },
  ])("rejects malformed nested policy fields before service mutation", (value) => {
    expect(() => parsePolicyEdit(value)).toThrow(CancellationInputProblem);
  });
});
