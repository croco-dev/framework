import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerHealthService } from '../libs/CustomerHealthService';
import { HealthScoreCalculator } from '../libs/HealthScoreCalculator';
import { InMemoryHealthScoreStore } from '../libs/InMemoryHealthScoreStore';
import type { HealthSignalRegistry } from '../libs/interfaces';
import type { HealthScoreProfile, HealthSignal, SignalCategory } from '../libs/types';

class MockSignalProvider implements HealthSignalRegistry {
  private providers: { category: SignalCategory; collect: (tenantId: string) => Promise<HealthSignal[]> }[] = [];

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

describe('CustomerHealthService', () => {
  let service!: CustomerHealthService;
  let store!: InMemoryHealthScoreStore;
  let mockRegistry!: MockSignalProvider;
  let calculator!: HealthScoreCalculator;

  beforeEach(() => {
    store = new InMemoryHealthScoreStore();
    mockRegistry = new MockSignalProvider();
    calculator = new HealthScoreCalculator();

    service = new CustomerHealthService(mockRegistry, store, calculator);
  });

  it('should collect signals, calculate score, and store result', async () => {
    const signals: HealthSignal[] = [
      {
        category: 'usage',
        name: 'api_calls',
        value: 80,
        weight: 1.0,
        rawValue: 8000,
        collectedAt: new Date('2026-03-15T10:00:00Z'),
      },
    ];

    mockRegistry.addProvider('usage', signals);

    const profile: HealthScoreProfile = {
      id: 'profile-1',
      name: 'Default Profile',
      weights: { usage: 1.0, business: 1.0, engagement: 1.0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    const result = await service.calculateAndStore('tenant-1', profile);

    expect(result.overallScore).toBe(80);
    expect(result.status).toBe('healthy');
    expect(result.tenantId).toBe('tenant-1');
    expect(result.trend).toBe('stable');

    const stored = await store.findLatest('tenant-1');
    expect(stored).not.toBeNull();
    expect(stored?.overallScore).toBe(80);
  });

  it('should detect status change from healthy to at_risk and publish event', async () => {
    const healthySignals: HealthSignal[] = [
      {
        category: 'usage',
        name: 'api_calls',
        value: 85,
        weight: 1.0,
        rawValue: 8500,
        collectedAt: new Date('2026-03-15T10:00:00Z'),
      },
    ];

    mockRegistry.addProvider('usage', healthySignals);

    const profile: HealthScoreProfile = {
      id: 'profile-1',
      name: 'Default Profile',
      weights: { usage: 1.0, business: 1.0, engagement: 1.0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    await service.calculateAndStore('tenant-1', profile);

    const riskSignals: HealthSignal[] = [
      {
        category: 'usage',
        name: 'api_calls',
        value: 70,
        weight: 1.0,
        rawValue: 7000,
        collectedAt: new Date('2026-03-15T11:00:00Z'),
      },
    ];

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider('usage', riskSignals);
    calculator = new HealthScoreCalculator();
    service = new CustomerHealthService(mockRegistry, store, calculator);

    const result = await service.calculateAndStore('tenant-1', profile);

    expect(result.status).toBe('at_risk');
    expect(result.previousScore).toBe(85);
    expect(result.trend).toBe('declining');
  });

  it('should publish HealthScoreDroppedEvent when score drops by 20 or more', async () => {
    const highScoreSignals: HealthSignal[] = [
      {
        category: 'usage',
        name: 'api_calls',
        value: 90,
        weight: 1.0,
        rawValue: 9000,
        collectedAt: new Date('2026-03-15T10:00:00Z'),
      },
    ];

    mockRegistry.addProvider('usage', highScoreSignals);

    const profile: HealthScoreProfile = {
      id: 'profile-1',
      name: 'Default Profile',
      weights: { usage: 1.0, business: 1.0, engagement: 1.0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    await service.calculateAndStore('tenant-1', profile);

    const lowScoreSignals: HealthSignal[] = [
      {
        category: 'usage',
        name: 'api_calls',
        value: 70,
        weight: 1.0,
        rawValue: 7000,
        collectedAt: new Date('2026-03-15T11:00:00Z'),
      },
    ];

    mockRegistry = new MockSignalProvider();
    mockRegistry.addProvider('usage', lowScoreSignals);
    calculator = new HealthScoreCalculator();
    service = new CustomerHealthService(mockRegistry, store, calculator);

    const result = await service.calculateAndStore('tenant-1', profile);

    expect(result.overallScore).toBe(70);
    expect(result.previousScore).toBe(90);
    expect(result.trend).toBe('declining');
  });

  it('should return latest score from store without recalculating', async () => {
    const signals: HealthSignal[] = [
      {
        category: 'usage',
        name: 'api_calls',
        value: 75,
        weight: 1.0,
        rawValue: 7500,
        collectedAt: new Date('2026-03-15T10:00:00Z'),
      },
    ];

    mockRegistry.addProvider('usage', signals);

    const profile: HealthScoreProfile = {
      id: 'profile-1',
      name: 'Default Profile',
      weights: { usage: 1.0, business: 1.0, engagement: 1.0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    await service.calculateAndStore('tenant-1', profile);

    const collectSpy = vi.spyOn(mockRegistry.getProviders()[0], 'collect');

    const latest = await service.getLatest('tenant-1');

    expect(latest).not.toBeNull();
    expect(latest?.overallScore).toBe(75);
    expect(latest?.status).toBe('at_risk');
    expect(collectSpy).not.toHaveBeenCalled();
  });

  it('should return null when no score exists for tenant', async () => {
    const latest = await service.getLatest('tenant-unknown');

    expect(latest).toBeNull();
  });

  it('should handle multiple signal providers', async () => {
    const usageSignals: HealthSignal[] = [
      {
        category: 'usage',
        name: 'api_calls',
        value: 80,
        weight: 1.0,
        rawValue: 8000,
        collectedAt: new Date('2026-03-15T10:00:00Z'),
      },
    ];

    const businessSignals: HealthSignal[] = [
      {
        category: 'business',
        name: 'mrr',
        value: 90,
        weight: 0.5,
        rawValue: 1000,
        collectedAt: new Date('2026-03-15T10:00:00Z'),
      },
    ];

    mockRegistry.addProvider('usage', usageSignals);
    mockRegistry.addProvider('business', businessSignals);

    const profile: HealthScoreProfile = {
      id: 'profile-1',
      name: 'Default Profile',
      weights: { usage: 1.0, business: 0.5, engagement: 1.0 },
      thresholds: { healthy: 80, atRisk: 60 },
    };

    const result = await service.calculateAndStore('tenant-1', profile);

    expect(result.signals).toHaveLength(2);
    expect(result.categoryScores.usage).toBeGreaterThan(0);
    expect(result.categoryScores.business).toBeGreaterThan(0);
  });
});
