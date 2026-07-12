import { beforeEach, describe, expect, it } from "vitest";
import type { DomainEvent } from "../libs/DomainEvent";
import { EventBusDiagnosticsProvider } from "../libs/diagnostics/EventBusDiagnosticsProvider";
import { EventBusConfig } from "../libs/EventBusConfig";
import { EventBusStats } from "../libs/EventBusStats";
import type { EventHandler } from "../libs/EventHandler";

class TestHandler implements EventHandler<DomainEvent> {
  async handle(): Promise<void> {}
}

describe("EventBusDiagnosticsProvider", () => {
  beforeEach(() => {
    EventBusConfig.setInstance(new EventBusConfig());
    EventBusConfig.setStats(new EventBusStats());
  });

  it("should expose subscriber and disjoint publish outcome counts", async () => {
    const config = EventBusConfig.getInstance();
    const stats = EventBusConfig.getStats();

    config.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });
    stats?.publish(false);
    stats?.publish(false);
    stats?.publish(true);
    stats?.drop();

    const health = await new EventBusDiagnosticsProvider().getHealth();

    expect(health.status).toBe("healthy");
    expect(health.details).toEqual({
      subscriberCount: 1,
      publishedCount: 2,
      failCount: 1,
      droppedPublishCount: 1,
    });
  });
});
