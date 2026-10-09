import { Container, RuntimeContainer } from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import type { HealthTransitionCommitResult } from "../libs/interfaces";
import type {
  HealthScoreProfile,
  HealthSignal,
  SignalCategory,
  TenantHealthScore,
} from "../libs/types";

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

class DeferredPublicationHealthScoreStore extends InMemoryHealthScoreStore {
  override async saveTransition(
    ...args: Parameters<InMemoryHealthScoreStore["saveTransition"]>
  ): Promise<HealthTransitionCommitResult> {
    const result = await super.saveTransition(...args);
    return result.committed ? { ...result, eventPublicationDeferred: true } : result;
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

    service = new CustomerHealthService(mockRegistry, store, calculator, mockEventPublisher);
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
      weights: { usage: 1, business: 0, engagement: 0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    const saveTransition = vi.spyOn(store, "saveTransition");
    const result = await service.calculateAndStore("tenant-1", profile);

    expect(result.overallScore).toBe(80);
    expect(result.status).toBe("healthy");
    expect(result.tenantId).toBe("tenant-1");
    expect(result.trend).toBe("stable");

    const stored = await store.findLatest("tenant-1");
    expect(stored).not.toBeNull();
    expect(stored?.overallScore).toBe(80);
    expect(saveTransition).toHaveBeenCalledTimes(1);
    expect(mockEventPublisher.publishIdempotently).not.toHaveBeenCalled();
  });

  it("does not persist a score when profile weights do not sum to 1", async () => {
    mockRegistry.addProvider("usage", [healthSignal(100, "2026-03-15T10:00:00Z")]);
    const profile: HealthScoreProfile = {
      id: "invalid-profile",
      name: "Invalid Profile",
      weights: { usage: 1, business: 1, engagement: 1 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    await expect(service.calculateAndStore("tenant-1", profile)).rejects.toMatchObject({
      code: "customer-health-core/invalid-score-input",
      input: "profile.weights",
    });
    await expect(store.findLatest("tenant-1")).resolves.toBeNull();
    expect(mockEventPublisher.publishIdempotently).not.toHaveBeenCalled();
  });

  it("should stop retrying when transition persistence never commits", async () => {
    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1, business: 0, engagement: 0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };
    mockRegistry.addProvider("usage", [healthSignal(80, "2026-03-15T10:00:00Z")]);
    const saveTransition = vi.spyOn(store, "saveTransition");
    const setTimeout = vi.spyOn(globalThis, "setTimeout");
    saveTransition
      .mockResolvedValueOnce({ committed: false, latest: null })
      .mockResolvedValueOnce({ committed: false, latest: null })
      .mockResolvedValueOnce({ committed: false, latest: null })
      .mockRejectedValueOnce(new Error("unbounded retry sentinel"));

    const error: unknown = await service
      .calculateAndStore("tenant-1", profile)
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Problem);
    expect(error).toMatchObject({
      attempts: 3,
      category: ProblemCategory.Conflict,
      code: "customer-health-core/transition-persistence-retry-exhausted",
    });
    expect(saveTransition).toHaveBeenCalledTimes(3);
    expect(setTimeout.mock.calls.map(([, delay]) => delay)).toEqual([10, 20]);
    setTimeout.mockRestore();
  });

  it("keeps stored history isolated from mutation of the committed service result", async () => {
    const rawValue = { nested: { count: 8 } };
    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1, business: 0, engagement: 0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };
    mockRegistry.addProvider("usage", [
      {
        category: "usage",
        name: "api_calls",
        value: 80,
        weight: 1,
        rawValue,
        collectedAt: new Date("2026-03-15T10:00:00Z"),
      },
    ]);

    const committed = await service.calculateAndStore("tenant-1", profile);
    const stored = structuredClone(committed);

    committed.transitionVersion = "mutated";
    committed.categoryScores.usage = -1;
    committed.calculatedAt.setTime(0);
    committed.signals[0]?.collectedAt.setTime(0);
    rawValue.nested.count = -1;

    await expect(service.getLatest("tenant-1")).resolves.toEqual(stored);
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
      weights: { usage: 1, business: 0, engagement: 0 },
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
    service = new CustomerHealthService(mockRegistry, store, calculator, mockEventPublisher);

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
      weights: { usage: 1, business: 0, engagement: 0 },
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
    service = new CustomerHealthService(mockRegistry, store, calculator, mockEventPublisher);

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

  it("keeps joined-transaction events pending until publication runs after commit", async () => {
    const deferredStore = new DeferredPublicationHealthScoreStore();
    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1, business: 0, engagement: 0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };
    mockRegistry.addProvider("usage", [healthSignal(90, "2026-03-15T10:00:00Z")]);
    service = new CustomerHealthService(
      mockRegistry,
      deferredStore,
      calculator,
      mockEventPublisher,
    );
    await service.calculateAndStore("tenant-1", profile);

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider("usage", [healthSignal(50, "2026-03-15T11:00:00Z")]);
    service = new CustomerHealthService(
      mockRegistry,
      deferredStore,
      calculator,
      mockEventPublisher,
    );

    await service.calculateAndStore("tenant-1", profile);

    expect(mockEventPublisher.publishIdempotently).not.toHaveBeenCalled();
    await expect(deferredStore.listPendingEventIntents("tenant-1")).resolves.toHaveLength(2);

    await expect(service.publishPendingEvents("tenant-1")).resolves.toBe(2);
    expect(mockEventPublisher.publishIdempotently).toHaveBeenCalledTimes(2);
    await expect(deferredStore.listPendingEventIntents("tenant-1")).resolves.toHaveLength(0);
  });

  it("should retry the persisted transition without deriving events from the stored score", async () => {
    const profile: HealthScoreProfile = {
      id: "profile-1",
      name: "Default Profile",
      weights: { usage: 1, business: 0, engagement: 0 },
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
    service = new CustomerHealthService(mockRegistry, store, calculator, mockEventPublisher);
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
      weights: { usage: 1, business: 0, engagement: 0 },
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
    service = new CustomerHealthService(mockRegistry, store, calculator, mockEventPublisher);
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
      weights: { usage: 1, business: 0, engagement: 0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };
    mockRegistry.addProvider("usage", [healthSignal(90, "2026-03-15T10:00:00Z")]);
    await service.calculateAndStore("tenant-1", profile);

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider("usage", [healthSignal(50, "2026-03-15T11:00:00Z")]);
    service = new CustomerHealthService(mockRegistry, store, calculator, mockEventPublisher);
    vi.mocked(mockEventPublisher.publishIdempotently).mockRejectedValue(
      new Error("publisher unavailable"),
    );
    await expect(service.calculateAndStore("tenant-1", profile)).rejects.toThrow(
      "publisher unavailable",
    );

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider("usage", [healthSignal(55, "2026-03-15T12:00:00Z")]);
    service = new CustomerHealthService(mockRegistry, store, calculator, mockEventPublisher);
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
      weights: { usage: 1, business: 0, engagement: 0 },
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
      new CustomerHealthService(
        riskRegistry,
        store,
        calculator,
        mockEventPublisher,
      ).calculateAndStore("tenant-1", profile),
      new CustomerHealthService(
        criticalRegistry,
        store,
        calculator,
        mockEventPublisher,
      ).calculateAndStore("tenant-1", profile),
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

  it.each([
    {
      name: "does not commit an older calculation over a newer score committed during its CAS retry",
      freshTime: "2026-03-15T10:06:00Z",
      expectedStatus: "critical",
      expectedStatusChanges: [["at_risk", "critical"]],
      expectedHistoryLength: 2,
    },
    {
      name: "retries when the conflicting score has the same calculation time",
      freshTime: "2026-03-15T10:05:00Z",
      expectedStatus: "healthy",
      expectedStatusChanges: [
        ["at_risk", "critical"],
        ["critical", "healthy"],
      ],
      expectedHistoryLength: 3,
    },
  ])(
    "$name",
    async ({ freshTime, expectedStatus, expectedStatusChanges, expectedHistoryLength }) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        const profile: HealthScoreProfile = {
          id: "profile-1",
          name: "Default Profile",
          weights: { usage: 1, business: 0, engagement: 0 },
          thresholds: { healthy: 80, atRisk: 60 },
        };
        const statusChanges: Array<[string, string]> = [];
        vi.mocked(mockEventPublisher.publishIdempotently).mockImplementation(async (event) => {
          if (event instanceof HealthStatusChangedEvent) {
            statusChanges.push([event.oldStatus, event.newStatus]);
          }
        });
        const serviceReturning = (value: number, collectedAt: string) => {
          const registry = new MockSignalProvider();
          registry.addProvider("usage", [healthSignal(value, collectedAt)]);
          return new CustomerHealthService(registry, store, calculator, mockEventPublisher);
        };

        vi.setSystemTime(new Date("2026-03-15T10:00:00.000Z"));
        await serviceReturning(70, "2026-03-15T10:00:00Z").calculateAndStore("tenant-1", profile);
        const listPendingEventIntents = vi.spyOn(store, "listPendingEventIntents");

        let markStaleReadLatest!: () => void;
        const staleReadLatest = new Promise<void>((resolve) => {
          markStaleReadLatest = resolve;
        });
        let releaseStale!: () => void;
        const staleReleased = new Promise<void>((resolve) => {
          releaseStale = resolve;
        });
        const readLatest = store.findLatest.bind(store);
        vi.spyOn(store, "findLatest").mockImplementationOnce(async (tenantId) => {
          const latest = await readLatest(tenantId);
          markStaleReadLatest();
          await staleReleased;
          return latest;
        });

        vi.setSystemTime(new Date("2026-03-15T10:05:00.000Z"));
        const stale = serviceReturning(90, "2026-03-15T10:05:00Z").calculateAndStore(
          "tenant-1",
          profile,
        );
        await staleReadLatest;

        vi.setSystemTime(new Date(freshTime));
        const fresh = await serviceReturning(40, freshTime).calculateAndStore("tenant-1", profile);

        releaseStale();
        const staleResult = await stale;

        const latest = await store.findLatest("tenant-1");
        expect(latest?.status).toBe(expectedStatus);
        expect(latest?.calculatedAt.toISOString()).toBe(fresh.calculatedAt.toISOString());
        expect(statusChanges).toEqual(expectedStatusChanges);
        expect(await store.findHistory("tenant-1", 10)).toHaveLength(expectedHistoryLength);
        expect(staleResult.status).toBe(expectedStatus);
        expect(staleResult.calculatedAt.toISOString()).toBe(fresh.calculatedAt.toISOString());
        expect(listPendingEventIntents).toHaveBeenCalledTimes(expectedHistoryLength - 1);
      } finally {
        vi.useRealTimers();
      }
    },
  );

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
      weights: { usage: 1, business: 0, engagement: 0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    await service.calculateAndStore("tenant-1", profile);
    vi.mocked(mockEventPublisher.publishIdempotently).mockClear();

    const slightlyLowerSignals: HealthSignal[] = [
      {
        category: "usage",
        name: "api_calls",
        value: 70,
        weight: 0.55,
        rawValue: 7000,
        collectedAt: new Date("2026-03-15T11:00:00Z"),
      },
      {
        category: "usage",
        name: "retention_buffer",
        value: 80,
        weight: 0.45,
        rawValue: 8000,
        collectedAt: new Date("2026-03-15T11:00:00Z"),
      },
    ];

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider("usage", slightlyLowerSignals);
    calculator = new HealthScoreCalculator();
    service = new CustomerHealthService(mockRegistry, store, calculator, mockEventPublisher);

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
      weights: { usage: 1, business: 0, engagement: 0 },
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

  it("should resolve from Container with optional event publisher wiring intact", async () => {
    Container.set(HealthSignalRegistry.token, mockRegistry as unknown as HealthSignalRegistry);
    Container.set(HealthScoreStore.token, store as unknown as HealthScoreStore);
    Container.set(HealthScoreCalculator, calculator);
    RuntimeContainer.set({
      id: CustomerHealthService,
      scope: "transient",
      factory: () =>
        new CustomerHealthService(
          Container.get(HealthSignalRegistry.token),
          Container.get(HealthScoreStore.token),
          Container.get(HealthScoreCalculator),
          Container.getOptional(CustomerHealthEventPublisher.token),
        ),
    });

    const resolved = Container.get(CustomerHealthService);

    expect(resolved).toBeInstanceOf(CustomerHealthService);
    expect(Container.get(CustomerHealthService)).not.toBe(resolved);
    await expect(resolved.publishPendingEvents("tenant-1")).resolves.toBe(0);

    Container.remove(CustomerHealthEventPublisher.token);
    const withoutPublisher = Container.get(CustomerHealthService);
    await expect(withoutPublisher.publishPendingEvents("tenant-1")).rejects.toBeInstanceOf(
      HealthEventPublisherNotConfiguredProblem,
    );
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
      weights: { usage: 1, business: 0, engagement: 0 },
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
      weights: { usage: 0.5, business: 0.5, engagement: 0 },
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

describe("CustomerHealthService.getTrend day window", () => {
  const NOW = new Date("2026-03-31T00:00:00.000Z");
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  let store: InMemoryHealthScoreStore;
  let service: CustomerHealthService;

  beforeEach(() => {
    Container.reset();
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    store = new InMemoryHealthScoreStore();
    service = new CustomerHealthService(
      new MockSignalProvider(),
      store,
      new HealthScoreCalculator(),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function commitScores(entries: readonly (readonly [number, number])[]): Promise<void> {
    let previous: TenantHealthScore | null = null;
    for (const [overallScore, millisecondsAgo] of entries) {
      const current: TenantHealthScore = {
        tenantId: "tenant-1",
        overallScore,
        status: overallScore >= 80 ? "healthy" : "critical",
        categoryScores: { usage: overallScore, business: 0, engagement: 0 },
        signals: [],
        trend: "stable",
        calculatedAt: new Date(NOW.getTime() - millisecondsAgo),
      };
      await store.saveTransition(current, previous, []);
      previous = current;
    }
  }

  it("compares scores across the requested days for hourly scoring", async () => {
    await commitScores([
      [90, 20 * DAY],
      ...Array.from({ length: 48 }, (_, index): [number, number] => [45, (47 - index) * HOUR]),
    ]);
    expect(await service.getTrend("tenant-1", 30)).toEqual({
      trend: "declining",
      changePercentage: -50,
    });
  });

  it("ignores older scores for weekly scoring", async () => {
    await commitScores(
      Array.from({ length: 40 }, (_, index): [number, number] => {
        const weeksAgo = 39 - index;
        return [weeksAgo > 5 ? 20 : 80, weeksAgo * 7 * DAY];
      }),
    );
    expect(await service.getTrend("tenant-1", 30)).toEqual({
      trend: "stable",
      changePercentage: 0,
    });
  });

  it("includes the exact start and end boundaries for daily scoring", async () => {
    await commitScores([
      [10, 30 * DAY + 1],
      ...Array.from({ length: 31 }, (_, index): [number, number] => [
        40 + index,
        (30 - index) * DAY,
      ]),
      [100, -1],
    ]);
    expect(await service.getTrend("tenant-1", 30)).toEqual({
      trend: "improving",
      changePercentage: 75,
    });
  });

  it.each([0, 1])("returns null with %i scores inside the window", async (count) => {
    await commitScores([
      [90, 31 * DAY],
      [80, 30 * DAY + 1],
      ...(count ? [[45, DAY] as const] : []),
    ]);
    expect(await service.getTrend("tenant-1", 30)).toBeNull();
  });

  it("sorts descending period results before comparing endpoints", async () => {
    await commitScores([
      [90, 20 * DAY],
      [70, DAY],
      [45, 0],
    ]);
    const findByPeriod = store.findHistoryByPeriod.bind(store);
    vi.spyOn(store, "findHistoryByPeriod").mockImplementation(async (...args) =>
      (await findByPeriod(...args)).reverse(),
    );
    expect(await service.getTrend("tenant-1", 30)).toEqual({
      trend: "declining",
      changePercentage: -50,
    });
    expect(store.findHistoryByPeriod).toHaveBeenCalledWith(
      "tenant-1",
      "day",
      new Date(NOW.getTime() - 30 * DAY),
      NOW,
    );
  });

  it.each([
    [0, 2, "improving", 200],
    [100, 105, "improving", 5],
    [100, 95, "declining", -5],
    [100, 104, "stable", 4],
    [100, 96, "stable", -4],
  ])("preserves the formula for %i to %i", async (oldest, newest, trend, changePercentage) => {
    await commitScores([
      [oldest, DAY],
      [newest, 0],
    ]);
    expect(await service.getTrend("tenant-1", 30)).toEqual({ trend, changePercentage });
  });
});
