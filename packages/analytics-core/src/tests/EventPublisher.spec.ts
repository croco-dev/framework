import { DomainEvent, EventBusConfig, EventPublisher } from "@croco/events-core";
import type { EventBus } from "@croco/events-core";
import { TxManager } from "@croco/tx-core";
import type { TxAdapter } from "@croco/tx-core";
import { describe, expect, it, vi } from "vitest";

import { AnalyticsManager } from "../libs/AnalyticsManager";
import { defineProductEvent, ProductEventCatalog } from "../libs/ProductEvent";

class ReportCommitted extends DomainEvent {
  static eventName = "report.committed";

  constructor(
    readonly tenantId: string,
    readonly userId: string,
  ) {
    super();
  }
}

class LocalAnalyticsManager extends AnalyticsManager {
  capture = vi.fn();
  identify = vi.fn();
  group = vi.fn();
}

const definition = defineProductEvent({
  name: "report.created",
  description: "A report has been committed for a tenant.",
  version: 1,
  subjectKind: "user",
  occurrence: "committed",
  scope: "tenant",
  owner: "reporting",
  sourceLocation: "src/reports/ReportService.ts:42",
  schema: { type: "object", properties: { reportType: { type: "string" } } },
  properties: { reportType: "Report period" },
});

describe("committed product event bridge", () => {
  it("captures only after commit and preserves domain event identity", async () => {
    const analytics = new LocalAnalyticsManager();
    const catalog = new ProductEventCatalog([definition], analytics);
    const delivered: string[] = [];
    const bus: EventBus = {
      async publish(event) {
        const report = event as ReportCommitted;
        delivered.push(report.eventId);
        catalog.captureTyped(
          definition,
          { reportType: "daily" },
          {
            appId: "reports-app",
            environment: "production",
            tenantId: report.tenantId,
            subject: { kind: "user", id: report.userId },
            eventId: report.eventId,
            occurredAt: report.timestamp.toISOString(),
          },
        );
      },
      subscribe() {},
      unsubscribe() {},
      clear() {},
    };
    const config = EventBusConfig.getInstance();
    config.setEventBus(bus);
    const adapter: TxAdapter<{ id: string }> = {
      transaction: async (callback) => callback({ id: "tx-1" }),
      savepoint: async (client, callback) => callback(client),
      supportsSavepoint: () => true,
    };
    const tx = new TxManager(adapter);
    const publisher = new EventPublisher(config, tx);
    const rolledBack = new ReportCommitted("tenant-a", "user-a");

    await expect(
      tx.runWithOutcome(async () => {
        publisher.publishAfterCommit(rolledBack);
        expect(analytics.capture).not.toHaveBeenCalled();
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(delivered).toEqual([]);
    expect(analytics.capture).not.toHaveBeenCalled();

    const committed = new ReportCommitted("tenant-a", "user-a");
    const outcome = await tx.runWithOutcome(async () => {
      publisher.publishAfterCommit(committed);
      expect(analytics.capture).not.toHaveBeenCalled();
    });

    expect(outcome.status).toBe("committed");
    expect(delivered).toEqual([committed.eventId]);
    expect(analytics.capture).toHaveBeenCalledExactlyOnceWith("report.created", {
      reportType: "daily",
      appId: "reports-app",
      environment: "production",
      tenantId: "tenant-a",
      subject: { kind: "user", id: "user-a" },
      eventId: committed.eventId,
      occurredAt: committed.timestamp.toISOString(),
      receivedAt: expect.any(String),
      schemaVersion: 1,
    });
  });
});
