import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerHealthService } from "../libs/CustomerHealthService";
import { HealthScoreDroppedEvent, HealthStatusChangedEvent } from "../libs/events";
import { HealthScoreCalculator } from "../libs/HealthScoreCalculator";
import { InMemoryHealthScoreStore } from "../libs/InMemoryHealthScoreStore";
import { HealthEventPublisherNotConfiguredProblem } from "../libs/problems/HealthProblems";
import {
  CustomerHealthEventPublisher,
  HealthScoreStore,
  HealthSignalRegistry,
} from "../libs/interfaces";
import type { HealthScoreProfile, HealthSignal, SignalCategory } from "../libs/types";

class MockSignalProvider implements HealthSignalRegistry {
  private providers: {
    category: SignalCategory;
    collect: (tenantId: string) => Promise<HealthSignal[]>;
  }[] = [];

  addProvider(category: SignalCategory, signals: HealthSignal[]): void {
    this.providers.push({
      category,
      collect: vi.fn().mockResolvedValue(signals),
    });
  }

  getProviders() {
    return this.providers.map((p) => ({
      category: p.category,
      collect: p.collect,
    }));
  }
}

describe("CustomerHealthService", () => {
  let service!: CustomerHealthService;
  let store!: InMemoryHealthScoreStore;
  let mockRegistry!: MockSignalProvider;
  let calculator!: HealthScoreCalculator;
  let mockEventPublisher!: CustomerHealthEventPublisher;

  beforeEach(() => {
    Container.reset();
    store = new InMemoryHealthScoreStore();
    mockRegistry = new MockSignalProvider();
    calculator = new HealthScoreCalculator();
    mockEventPublisher = {
      publishIdempotently: vi.fn().mockResolvedValue(undefined),
    } as unknown as CustomerHealthEventPublisher;

    Container.set(CustomerHealthEventPublisher.token, mockEventPublisher);

    service = new CustomerHealthService(mockRegistry, store, calculator);
  });

  it("should collect signals, calculate score, and store result", async () => {
    const signals: HealthSignal[] = [
      {
        category: "usage",
        name: "api_calls",
        value: 80,
        weight: 1.0,
        rawValue: 8000,
        collectedAt: new Date("2026-03-15T10:00:00Z"),
      },
    ];

    mockRegistry.addProvider("usage", signals);

    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1.0, business: 1.0, engagement: 1.0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    const result = await service.calculateAndStore("tenant-1", profile);

    expect(result.overallScore).toBe(80);
    expect(result.status).toBe("healthy");
    expect(result.tenantId).toBe("tenant-1");
    expect(result.trend).toBe("stable");

    const stored = await store.findLatest("tenant-1");
    expect(stored).not.toBeNull();
    expect(stored?.overallScore).toBe(80);
    expect(mockEventPublisher.publishIdempotently).not.toHaveBeenCalled();
  });

  it("should detect status change from healthy to at_risk and publish event", async () => {
    const healthySignals: HealthSignal[] = [
      {
        category: "usage",
        name: "api_calls",
        value: 85,
        weight: 1.0,
        rawValue: 8500,
        collectedAt: new Date("2026-03-15T10:00:00Z"),
      },
    ];

    mockRegistry.addProvider("usage", healthySignals);

    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1.0, business: 1.0, engagement: 1.0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    await service.calculateAndStore("tenant-1", profile);

    const riskSignals: HealthSignal[] = [
      {
        category: "usage",
        name: "api_calls",
        value: 70,
        weight: 1.0,
        rawValue: 7000,
        collectedAt: new Date("2026-03-15T11:00:00Z"),
      },
    ];

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider("usage", riskSignals);
    calculator = new HealthScoreCalculator();
    service = new CustomerHealthService(mockRegistry, store, calculator);

    const result = await service.calculateAndStore("tenant-1", profile);

    expect(result.status).toBe("at_risk");
    expect(result.previousScore).toBe(85);
    expect(result.trend).toBe("declining");
    expect(mockEventPublisher.publishIdempotently).toHaveBeenCalledWith(
      expect.any(HealthStatusChangedEvent),
    );

    const statusChangedEvent = vi
      .mocked(mockEventPublisher.publishIdempotently)
      .mock.calls.find(([event]) => event instanceof HealthStatusChangedEvent)?.[0];

    expect(statusChangedEvent).toMatchObject({
      tenantId: "tenant-1",
      oldStatus: "healthy",
      newStatus: "at_risk",
      score: 70,
    });
  });

  it("should publish HealthScoreDroppedEvent when score drops by 20 or more", async () => {
    const highScoreSignals: HealthSignal[] = [
      {
        category: "usage",
        name: "api_calls",
        value: 90,
        weight: 1.0,
        rawValue: 9000,
        collectedAt: new Date("2026-03-15T10:00:00Z"),
      },
    ];

    mockRegistry.addProvider("usage", highScoreSignals);

    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1.0, business: 1.0, engagement: 1.0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    await service.calculateAndStore("tenant-1", profile);

    const lowScoreSignals: HealthSignal[] = [
      {
        category: "usage",
        name: "api_calls",
        value: 70,
        weight: 1.0,
        rawValue: 7000,
        collectedAt: new Date("2026-03-15T11:00:00Z"),
      },
    ];

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider("usage", lowScoreSignals);
    calculator = new HealthScoreCalculator();
    service = new CustomerHealthService(mockRegistry, store, calculator);

    const result = await service.calculateAndStore("tenant-1", profile);

    expect(result.overallScore).toBe(70);
    expect(result.previousScore).toBe(90);
    expect(result.trend).toBe("declining");
    expect(mockEventPublisher.publishIdempotently).toHaveBeenCalledWith(
      expect.any(HealthScoreDroppedEvent),
    );

    const scoreDroppedEvent = vi
      .mocked(mockEventPublisher.publishIdempotently)
      .mock.calls.find(([event]) => event instanceof HealthScoreDroppedEvent)?.[0];

    expect(scoreDroppedEvent).toMatchObject({
      tenantId: "tenant-1",
      previousScore: 90,
      currentScore: 70,
      dropPercentage: expect.closeTo(22.222222, 5),
    });
  });

  it("should retry the persisted transition without deriving events from the stored score", async () => {
    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1, business: 1, engagement: 1 },
      thresholds: { healthy: 80, atRisk: 60 },
    };
    mockRegistry.addProvider("usage", [
      {
        category: "usage",
        name: "api_calls",
        value: 90,
        weight: 1,
        rawValue: 9000,
        collectedAt: new Date("2026-03-15T10:00:00Z"),
      },
    ]);
    await service.calculateAndStore("tenant-1", profile);

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider("usage", [
      {
        category: "usage",
        name: "api_calls",
        value: 50,
        weight: 1,
        rawValue: 5000,
        collectedAt: new Date("2026-03-15T11:00:00Z"),
      },
    ]);
    service = new CustomerHealthService(mockRegistry, store, calculator);
    vi.mocked(mockEventPublisher.publishIdempotently).mockRejectedValueOnce(
      new Error("publisher unavailable"),
    );

    await expect(service.calculateAndStore("tenant-1", profile)).rejects.toThrow(
      "publisher unavailable",
    );
    expect((await store.findLatest("tenant-1"))?.overallScore).toBe(50);
    expect(await store.listPendingEventIntents("tenant-1")).toHaveLength(2);

    vi.mocked(mockEventPublisher.publishIdempotently).mockClear();
    await service.calculateAndStore("tenant-1", profile);

    const publishedEvents = vi
      .mocked(mockEventPublisher.publishIdempotently)
      .mock.calls.map(([event]) => event);
    expect(publishedEvents).toHaveLength(2);
    expect(publishedEvents[0]).toMatchObject({
      oldStatus: "healthy",
      newStatus: "critical",
      score: 50,
    });
    expect(publishedEvents[1]).toMatchObject({
      previousScore: 90,
      currentScore: 50,
      dropPercentage: expect.closeTo(44.444444, 5),
    });
    expect(await store.listPendingEventIntents("tenant-1")).toHaveLength(0);
  });

  it("should reuse the event identity when acknowledgement fails after publication", async () => {
    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1, business: 1, engagement: 1 },
      thresholds: { healthy: 80, atRisk: 60 },
    };
    mockRegistry.addProvider("usage", [
      {
        category: "usage",
        name: "api_calls",
        value: 85,
        weight: 1,
        rawValue: 8500,
        collectedAt: new Date("2026-03-15T10:00:00Z"),
      },
    ]);
    await service.calculateAndStore("tenant-1", profile);

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider("usage", [
      {
        category: "usage",
        name: "api_calls",
        value: 70,
        weight: 1,
        rawValue: 7000,
        collectedAt: new Date("2026-03-15T11:00:00Z"),
      },
    ]);
    service = new CustomerHealthService(mockRegistry, store, calculator);
    const markPublished = vi.spyOn(store, "markEventIntentPublished");
    markPublished.mockRejectedValueOnce(new Error("acknowledgement unavailable"));

    await expect(service.calculateAndStore("tenant-1", profile)).rejects.toThrow(
      "acknowledgement unavailable",
    );
    const firstEvent = vi.mocked(mockEventPublisher.publishIdempotently).mock.calls.at(-1)?.[0];

    markPublished.mockRestore();
    vi.mocked(mockEventPublisher.publishIdempotently).mockClear();
    await service.publishPendingEvents("tenant-1");

    const retriedEvent = vi.mocked(mockEventPublisher.publishIdempotently).mock.calls[0]?.[0];
    expect(retriedEvent?.eventId).toBe(firstEvent?.eventId);
    expect(await store.listPendingEventIntents("tenant-1")).toHaveLength(0);
  });

  it("should commit a later no-event score before retrying an unavailable publisher", async () => {
    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1, business: 1, engagement: 1 },
      thresholds: { healthy: 80, atRisk: 60 },
    };
    mockRegistry.addProvider("usage", [healthSignal(90, "2026-03-15T10:00:00Z")]);
    await service.calculateAndStore("tenant-1", profile);

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider("usage", [healthSignal(50, "2026-03-15T11:00:00Z")]);
    service = new CustomerHealthService(mockRegistry, store, calculator);
    vi.mocked(mockEventPublisher.publishIdempotently).mockRejectedValue(
      new Error("publisher unavailable"),
    );
    await expect(service.calculateAndStore("tenant-1", profile)).rejects.toThrow(
      "publisher unavailable",
    );

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider("usage", [healthSignal(55, "2026-03-15T12:00:00Z")]);
    service = new CustomerHealthService(mockRegistry, store, calculator);
    await expect(service.calculateAndStore("tenant-1", profile)).rejects.toThrow(
      "publisher unavailable",
    );

    expect((await store.findLatest("tenant-1"))?.overallScore).toBe(55);
    expect(await store.findHistory("tenant-1", 10)).toHaveLength(3);
    expect(await store.listPendingEventIntents("tenant-1")).toHaveLength(2);
  });

  it("should serialize concurrent calculations and derive events from committed predecessors", async () => {
    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1, business: 1, engagement: 1 },
      thresholds: { healthy: 80, atRisk: 60 },
    };
    mockRegistry.addProvider("usage", [healthSignal(90, "2026-03-15T10:00:00Z")]);
    await service.calculateAndStore("tenant-1", profile);

    const deliveredIds = new Set<string>();
    const deliveredEvents: Array<HealthStatusChangedEvent | HealthScoreDroppedEvent> = [];
    vi.mocked(mockEventPublisher.publishIdempotently).mockImplementation(async (event) => {
      if (deliveredIds.has(event.eventId)) return;
      deliveredIds.add(event.eventId);
      deliveredEvents.push(event as HealthStatusChangedEvent | HealthScoreDroppedEvent);
    });
    const riskRegistry = new MockSignalProvider();
    riskRegistry.addProvider("usage", [healthSignal(70, "2026-03-15T11:00:00Z")]);
    const criticalRegistry = new MockSignalProvider();
    criticalRegistry.addProvider("usage", [healthSignal(50, "2026-03-15T11:00:01Z")]);

    await Promise.all([
      new CustomerHealthService(riskRegistry, store, calculator).calculateAndStore(
        "tenant-1",
        profile,
      ),
      new CustomerHealthService(criticalRegistry, store, calculator).calculateAndStore(
        "tenant-1",
        profile,
      ),
    ]);

    const history = await store.findHistory("tenant-1", 10);
    expect(history.map(({ overallScore }) => overallScore)).toHaveLength(3);
    const chronologicalHistory = [...history].reverse();
    const expectedStatusTransitions = chronologicalHistory
      .slice(1)
      .map((current, index) => ({ previous: chronologicalHistory[index], current }))
      .filter(({ previous, current }) => previous?.status !== current.status)
      .map(({ previous, current }) => [previous?.status, current.status, current.overallScore]);
    const actualStatusTransitions = deliveredEvents
      .filter(
        (event): event is HealthStatusChangedEvent => event instanceof HealthStatusChangedEvent,
      )
      .map((event) => [event.oldStatus, event.newStatus, event.score]);
    expect(actualStatusTransitions).toEqual(expectedStatusTransitions);
    expect(deliveredIds.size).toBe(deliveredEvents.length);
    expect(await store.listPendingEventIntents("tenant-1")).toHaveLength(0);
  });

  it("should not publish score dropped event when score drop is below threshold", async () => {
    const initialSignals: HealthSignal[] = [
      {
        category: "usage",
        name: "api_calls",
        value: 85,
        weight: 1.0,
        rawValue: 8500,
        collectedAt: new Date("2026-03-15T10:00:00Z"),
      },
    ];

    mockRegistry.addProvider("usage", initialSignals);

    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1.0, business: 1.0, engagement: 1.0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    await service.calculateAndStore("tenant-1", profile);
    vi.mocked(mockEventPublisher.publishIdempotently).mockClear();

    const slightlyLowerSignals: HealthSignal[] = [
      {
        category: "usage",
        name: "api_calls",
        value: 70,
        weight: 1.1,
        rawValue: 7000,
        collectedAt: new Date("2026-03-15T11:00:00Z"),
      },
      {
        category: "usage",
        name: "retention_buffer",
        value: 80,
        weight: 0.9,
        rawValue: 8000,
        collectedAt: new Date("2026-03-15T11:00:00Z"),
      },
    ];

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider("usage", slightlyLowerSignals);
    calculator = new HealthScoreCalculator();
    service = new CustomerHealthService(mockRegistry, store, calculator);

    const result = await service.calculateAndStore("tenant-1", profile);

    expect(result.overallScore).toBe(74.5);
    expect(result.previousScore).toBe(85);
    expect(result.trend).toBe("declining");
    expect(mockEventPublisher.publishIdempotently).not.toHaveBeenCalledWith(
      expect.any(HealthScoreDroppedEvent),
    );
  });

  it("should skip publishing when no event publisher is configured", async () => {
    Container.remove(CustomerHealthEventPublisher.token);
    service = new CustomerHealthService(mockRegistry, store, calculator);

    const healthySignals: HealthSignal[] = [
      {
        category: "usage",
        name: "api_calls",
        value: 85,
        weight: 1.0,
        rawValue: 8500,
        collectedAt: new Date("2026-03-15T10:00:00Z"),
      },
    ];

    mockRegistry.addProvider("usage", healthySignals);

    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1.0, business: 1.0, engagement: 1.0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    await service.calculateAndStore("tenant-1", profile);

    const lowerSignals: HealthSignal[] = [
      {
        category: "usage",
        name: "api_calls",
        value: 60,
        weight: 1.0,
        rawValue: 6000,
        collectedAt: new Date("2026-03-15T11:00:00Z"),
      },
    ];

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider("usage", lowerSignals);
    calculator = new HealthScoreCalculator();
    service = new CustomerHealthService(mockRegistry, store, calculator);

    const result = await service.calculateAndStore("tenant-1", profile);

    expect(result.status).toBe("at_risk");
    expect(result.previousScore).toBe(85);
    expect(vi.mocked(mockEventPublisher.publishIdempotently)).not.toHaveBeenCalled();
    await expect(service.publishPendingEvents("tenant-1")).rejects.toBeInstanceOf(
      HealthEventPublisherNotConfiguredProblem,
    );
  });

  it("should resolve from Container with optional event publisher wiring intact", () => {
    Container.set(HealthSignalRegistry.token, mockRegistry as unknown as HealthSignalRegistry);
    Container.set(HealthScoreStore.token, store as unknown as HealthScoreStore);
    Container.set(HealthScoreCalculator, calculator);
    Container.register(CustomerHealthService, "transient");

    const resolved = Container.get(CustomerHealthService);

    expect(resolved).toBeInstanceOf(CustomerHealthService);
  });

  it("should return latest score from store without recalculating", async () => {
    const signals: HealthSignal[] = [
      {
        category: "usage",
        name: "api_calls",
        value: 75,
        weight: 1.0,
        rawValue: 7500,
        collectedAt: new Date("2026-03-15T10:00:00Z"),
      },
    ];

    mockRegistry.addProvider("usage", signals);

    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1.0, business: 1.0, engagement: 1.0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    const collectSpy = vi.spyOn(mockRegistry.getProviders()[0], "collect");

    await service.calculateAndStore("tenant-1", profile);

    collectSpy.mockClear();

    const latest = await service.getLatest("tenant-1");

    expect(latest).not.toBeNull();
    expect(latest?.overallScore).toBe(75);
    expect(latest?.status).toBe("at_risk");
    expect(collectSpy).not.toHaveBeenCalled();
  });

  it("should return null when no score exists for tenant", async () => {
    const latest = await service.getLatest("tenant-unknown");

    expect(latest).toBeNull();
  });

  it("should handle multiple signal providers", async () => {
    const usageSignals: HealthSignal[] = [
      {
        category: "usage",
        name: "api_calls",
        value: 80,
        weight: 1.0,
        rawValue: 8000,
        collectedAt: new Date("2026-03-15T10:00:00Z"),
      },
    ];

    const businessSignals: HealthSignal[] = [
      {
        category: "business",
        name: "mrr",
        value: 90,
        weight: 0.5,
        rawValue: 1000,
        collectedAt: new Date("2026-03-15T10:00:00Z"),
      },
    ];

    mockRegistry.addProvider("usage", usageSignals);
    mockRegistry.addProvider("business", businessSignals);

    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1.0, business: 0.5, engagement: 1.0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    const result = await service.calculateAndStore("tenant-1", profile);

    expect(result.signals).toHaveLength(2);
    expect(result.categoryScores.usage).toBeGreaterThan(0);
    expect(result.categoryScores.business).toBeGreaterThan(0);
  });
});

function healthSignal(value: number, collectedAt: string): HealthSignal {
  return {
    category: "usage",
    name: "api_calls",
    value,
    weight: 1,
    rawValue: value * 100,
    collectedAt: new Date(collectedAt),
  };
}
