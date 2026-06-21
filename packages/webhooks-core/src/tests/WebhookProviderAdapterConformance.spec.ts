import { describe, expect, it } from "vitest";
import {
  InvalidWebhookSignatureProblem,
  createWebhookProviderAdapterConformanceSuite,
  type WebhookProviderAdapter,
} from "../index";

function createAdapter(): WebhookProviderAdapter {
  return {
    provider: "fixture",
    verify: ({ rawBody, headers }) => {
      if (headers["webhook-signature"] !== "valid") {
        throw new InvalidWebhookSignatureProblem({
          provider: "fixture",
          reason: "invalid signature",
        });
      }

      const parsed = JSON.parse(String(rawBody)) as {
        id: string;
        type: string;
        data: { subscriptionId: string; tenantId: string };
      };

      return {
        id: parsed.id,
        provider: "fixture",
        type: parsed.type,
        payload: parsed.data,
        tenantId: parsed.data.tenantId,
      };
    },
  };
}

describe("webhook provider adapter conformance", () => {
  const suite = createWebhookProviderAdapterConformanceSuite({
    createAdapter,
    validRequest: {
      rawBody: JSON.stringify({
        id: "evt-conformance",
        type: "subscription.created",
        data: {
          subscriptionId: "sub-conformance",
          tenantId: "tenant-conformance",
        },
      }),
      headers: {
        "Webhook-Signature": "valid",
      },
    },
    invalidSignatureRequest: {
      rawBody: JSON.stringify({
        id: "evt-conformance",
        type: "subscription.created",
        data: {
          subscriptionId: "sub-conformance",
          tenantId: "tenant-conformance",
        },
      }),
      headers: {
        "Webhook-Signature": "invalid",
      },
    },
    expectedEvent: {
      id: "evt-conformance",
      provider: "fixture",
      type: "subscription.created",
    },
  });

  it("exposes the required provider gateway contract cases", () => {
    expect(suite.cases.map((testCase) => testCase.name)).toEqual([
      "verifies a valid request into the provider-neutral webhook event envelope",
      "rejects invalid signatures before gateway dispatch",
      "reuses gateway idempotency for deterministic duplicate deliveries",
      "replays local fixtures through the same gateway path",
    ]);
  });

  it("verifies a valid request into the provider-neutral webhook event envelope", async () => {
    await runCase(0);
  });

  it("rejects invalid signatures before gateway dispatch", async () => {
    await runCase(1);
  });

  it("reuses gateway idempotency for deterministic duplicate deliveries", async () => {
    await runCase(2);
  });

  it("replays local fixtures through the same gateway path", async () => {
    await runCase(3);
  });

  async function runCase(index: number): Promise<void> {
    const testCase = suite.cases[index];
    if (!testCase) {
      throw new Error(`Missing conformance case at index ${index}.`);
    }

    await testCase.run();
  }
});
