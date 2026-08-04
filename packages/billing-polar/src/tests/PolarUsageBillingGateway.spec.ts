import type { UsageBillingGateway } from "@croco/billing-core";
import { defineMeter, InMemoryBillableUsageJournal } from "@croco/metering-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolarUsageBillingGateway, bindPolarUsageMeter } from "../libs/PolarUsageBillingGateway";
import { PolarUsageDeliveryWorker } from "../libs/PolarUsageDeliveryWorker";
import {
  PolarRetryableUpstreamProblem,
  PolarUsageMeterMappingProblem,
} from "../libs/problems/PolarBillingProblems";
import type { PolarConfig } from "../types";

const mockIngest = vi.fn();
const mockListCustomerMeters = vi.fn();

vi.mock("@polar-sh/sdk", () => {
  class Polar {
    readonly events = { ingest: mockIngest };
    readonly customerMeters = { list: mockListCustomerMeters };

    constructor(_options: unknown) {}
  }

  return { Polar };
});

const meter = defineMeter({
  key: "ai.tokens",
  aggregation: "SUM",
  unit: "token",
  billing: "required",
  dimensions: {
    model: { kind: "enum", values: ["gpt-5-mini"] },
  },
});

const config: PolarConfig = {
  accessToken: "polar-token",
  environment: "sandbox",
  webhookSecret: "webhook-secret",
  organizationId: "org-123",
};

const binding = bindPolarUsageMeter({
  meter,
  eventName: "ai_tokens_consumed",
  providerMeterId: "polar-meter-123",
  valueMetadataKey: "tokens",
});

function createGateway(): PolarUsageBillingGateway {
  return new PolarUsageBillingGateway(config, [binding]);
}

function event(eventId = "event-1") {
  return {
    billingAccountId: "tenant-1",
    dimensions: { model: "gpt-5-mini" },
    eventId,
    meterId: meter.key,
    occurredAt: new Date("2026-08-01T00:00:00.000Z"),
    value: 42,
  };
}

describe("PolarUsageBillingGateway", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("maps typed meter usage to a provider-deduplicated Polar event", async () => {
    mockIngest.mockResolvedValue({ inserted: 1, duplicates: 0 });

    await expect(createGateway().ingest([event()])).resolves.toEqual({
      receipts: [{ eventId: "event-1", status: "inserted" }],
    });
    expect(mockIngest).toHaveBeenCalledWith(
      {
        events: [
          {
            externalCustomerId: "tenant-1",
            externalId: "event-1",
            name: "ai_tokens_consumed",
            organizationId: "org-123",
            timestamp: new Date("2026-08-01T00:00:00.000Z"),
            metadata: { model: "gpt-5-mini", tokens: 42 },
          },
        ],
      },
      expect.objectContaining({
        retryCodes: ["429", "500", "502", "503", "504"],
        timeoutMs: 5_000,
      }),
    );
  });

  it("treats a duplicate provider acknowledgement as a successful receipt", async () => {
    mockIngest.mockResolvedValue({ inserted: 0, duplicates: 1 });

    await expect(createGateway().ingest([event()])).resolves.toEqual({
      receipts: [{ eventId: "event-1", status: "duplicate" }],
    });
  });

  it("rejects missing meter mappings with stable recovery guidance", async () => {
    mockIngest.mockResolvedValue({ inserted: 1, duplicates: 0 });

    await expect(
      createGateway().ingest([{ ...event(), meterId: "storage.bytes" }]),
    ).rejects.toMatchObject({
      code: "billing-polar/usage-meter-mapping-not-found",
      extensions: expect.objectContaining({ recovery: expect.any(String) }),
    });
  });

  it("rejects a value metadata key that would overwrite a declared meter dimension", () => {
    expect(() =>
      bindPolarUsageMeter({
        meter,
        eventName: "ai_tokens_consumed",
        providerMeterId: "polar-meter-123",
        valueMetadataKey: "model",
      }),
    ).toThrow(PolarUsageMeterMappingProblem);
  });

  it("reports a missing usage customer with stable replay recovery guidance", async () => {
    mockIngest.mockRejectedValue(
      Object.assign(new Error("Customer not found"), {
        name: "ResourceNotFound",
        status: 404,
      }),
    );

    await expect(createGateway().ingest([event()])).rejects.toMatchObject({
      code: "billing-polar/usage-customer-not-found",
      extensions: expect.objectContaining({ recovery: expect.any(String) }),
    });
  });

  it("resolves customer meter state without leaking a Polar customer id to callers", async () => {
    mockListCustomerMeters.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield {
          result: {
            items: [
              {
                meterId: "polar-meter-123",
                consumedUnits: 42,
                createdAt: new Date("2026-07-31T00:00:00.000Z"),
                modifiedAt: new Date("2026-08-01T00:00:00.000Z"),
              },
            ],
          },
        };
      },
    });

    await expect(
      createGateway().getCustomerMeterState({ billingAccountId: "tenant-1", meterId: meter.key }),
    ).resolves.toEqual({
      billingAccountId: "tenant-1",
      meterId: meter.key,
      value: 42,
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(mockListCustomerMeters).toHaveBeenCalledWith(
      { externalCustomerId: "tenant-1", meterId: "polar-meter-123", limit: 2 },
      expect.any(Object),
    );
  });
});

describe("PolarUsageDeliveryWorker", () => {
  async function appendDeliverable(
    journal: InMemoryBillableUsageJournal,
    eventId: string,
  ): Promise<void> {
    await journal.append({
      eventId,
      tenantId: "tenant-1",
      meterId: meter.key,
      aggregation: "SUM",
      unit: "token",
      value: 42,
      dimensions: { model: "gpt-5-mini" },
    });
    await journal.markDeliverable(eventId, new Date("2026-08-01T00:00:00.000Z"));
  }

  function createWorker(
    journal: InMemoryBillableUsageJournal,
    usageGateway: UsageBillingGateway,
    maxBatchSize = 2,
  ) {
    return new PolarUsageDeliveryWorker(journal, usageGateway, {
      ownerId: "worker-1",
      leaseDurationMs: 60_000,
      maxBatchSize,
      retryBaseDelayMs: 1_000,
      retryMaxDelayMs: 4_000,
    });
  }

  it("accepts inserted and duplicate receipts without re-delivering a claimed journal event", async () => {
    const journal = new InMemoryBillableUsageJournal();
    await appendDeliverable(journal, "event-inserted");
    await appendDeliverable(journal, "event-duplicate");
    const ingest = vi
      .fn()
      .mockResolvedValueOnce({ receipts: [{ eventId: "event-inserted", status: "inserted" }] })
      .mockResolvedValueOnce({ receipts: [{ eventId: "event-duplicate", status: "duplicate" }] });

    await expect(
      createWorker(journal, { ingest, getCustomerMeterState: vi.fn() }).deliverNextBatch(
        new Date("2026-08-01T00:01:00.000Z"),
      ),
    ).resolves.toEqual({ accepted: 2, retryableFailed: 0, terminalFailed: 0 });
    await expect(journal.get("event-inserted")).resolves.toMatchObject({ state: "accepted" });
    await expect(journal.get("event-duplicate")).resolves.toMatchObject({ state: "accepted" });
  });

  it("retains retryable provider failures with bounded retry metadata", async () => {
    const journal = new InMemoryBillableUsageJournal();
    await appendDeliverable(journal, "event-retry");
    const usageGateway: UsageBillingGateway = {
      ingest: vi
        .fn()
        .mockRejectedValue(
          new PolarRetryableUpstreamProblem({ operation: "usage.ingest", provider: "polar" }),
        ),
      getCustomerMeterState: vi.fn(),
    };

    await expect(
      createWorker(journal, usageGateway).deliverNextBatch(new Date("2026-08-01T00:01:00.000Z")),
    ).resolves.toEqual({ accepted: 0, retryableFailed: 1, terminalFailed: 0 });
    await expect(journal.get("event-retry")).resolves.toMatchObject({
      state: "retryable-failed",
      retryCount: 1,
      retryAt: new Date("2026-08-01T00:01:01.000Z"),
      failure: { code: "billing-polar/retryable-upstream" },
    });
  });

  it("keeps terminal mapping failures inspectable and limits one run to its configured batch size", async () => {
    const journal = new InMemoryBillableUsageJournal();
    await appendDeliverable(journal, "event-terminal");
    await appendDeliverable(journal, "event-pending");
    const usageGateway: UsageBillingGateway = {
      ingest: vi.fn().mockRejectedValue(new PolarUsageMeterMappingProblem(meter.key)),
      getCustomerMeterState: vi.fn(),
    };

    await expect(
      createWorker(journal, usageGateway, 1).deliverNextBatch(new Date("2026-08-01T00:01:00.000Z")),
    ).resolves.toEqual({ accepted: 0, retryableFailed: 0, terminalFailed: 1 });
    await expect(journal.get("event-terminal")).resolves.toMatchObject({
      state: "terminal-failed",
      failure: { code: "billing-polar/usage-meter-mapping-not-found" },
    });
    await expect(journal.get("event-pending")).resolves.toMatchObject({ state: "pending" });
  });

  it("claims each event immediately before provider delivery rather than expiring a prefetched batch", async () => {
    const journal = new InMemoryBillableUsageJournal();
    await appendDeliverable(journal, "event-first");
    await appendDeliverable(journal, "event-second");
    const statesBeforeIngest: Array<string | undefined> = [];
    const usageGateway: UsageBillingGateway = {
      ingest: vi.fn(async ([usage]) => {
        const otherEventId = usage?.eventId === "event-first" ? "event-second" : "event-first";
        statesBeforeIngest.push((await journal.get(otherEventId))?.state);
        return { receipts: [{ eventId: usage?.eventId ?? "", status: "inserted" as const }] };
      }),
      getCustomerMeterState: vi.fn(),
    };

    await expect(
      createWorker(journal, usageGateway).deliverNextBatch(new Date("2026-08-01T00:01:00.000Z")),
    ).resolves.toEqual({ accepted: 2, retryableFailed: 0, terminalFailed: 0 });
    expect(statesBeforeIngest).toEqual(["pending", "accepted"]);
  });

  it("surfaces journal acceptance failures instead of classifying an accepted provider event as terminal", async () => {
    const journal = new InMemoryBillableUsageJournal();
    await appendDeliverable(journal, "event-journal-failure");
    const markTerminalFailed = vi.spyOn(journal, "markTerminalFailed");
    vi.spyOn(journal, "markAccepted").mockRejectedValueOnce(
      new PolarUsageMeterMappingProblem(meter.key, "Journal is unavailable"),
    );
    const usageGateway: UsageBillingGateway = {
      ingest: vi.fn().mockResolvedValue({
        receipts: [{ eventId: "event-journal-failure", status: "inserted" }],
      }),
      getCustomerMeterState: vi.fn(),
    };

    await expect(
      createWorker(journal, usageGateway).deliverNextBatch(new Date("2026-08-01T00:01:00.000Z")),
    ).rejects.toMatchObject({ code: "billing-polar/usage-meter-mapping-not-found" });
    expect(markTerminalFailed).not.toHaveBeenCalled();
  });
});
