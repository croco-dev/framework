import { describe, expect, it } from "vitest";
import {
  InvalidWebhookFixtureProblem,
  normalizeWebhookHeaders,
  parseWebhookReplayFixture,
} from "../index";

describe("webhook fixtures", () => {
  it("parses replay fixtures and normalizes headers", () => {
    const fixture = parseWebhookReplayFixture(
      JSON.stringify({
        provider: "stripe",
        rawBody: '{"id":"evt-1"}',
        headers: {
          "Stripe-Signature": "valid",
          "X-Multi": ["a", "b"],
        },
        eventId: "evt-1",
        eventType: "checkout.session.completed",
        receivedAt: "2026-06-21T00:00:00.000Z",
      }),
    );

    expect(fixture.provider).toBe("stripe");
    expect(fixture.receivedAt?.toISOString()).toBe("2026-06-21T00:00:00.000Z");
    expect(normalizeWebhookHeaders(fixture.headers)).toEqual({
      "stripe-signature": "valid",
      "x-multi": "a, b",
    });
  });

  it("rejects malformed local replay fixtures as Problems", () => {
    expect(() => parseWebhookReplayFixture("{")).toThrow(InvalidWebhookFixtureProblem);
    expect(() =>
      parseWebhookReplayFixture({
        provider: "stripe",
        rawBody: "{}",
        headers: { signature: 1 },
      }),
    ).toThrow(InvalidWebhookFixtureProblem);
  });
});
