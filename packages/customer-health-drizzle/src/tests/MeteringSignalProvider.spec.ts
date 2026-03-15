import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@croco/customer-health-core', () => ({
  SignalProvider: class {},
}));

import type { UsageStorage } from '../libs/MeteringSignalProvider';
import { MeteringSignalProvider } from '../libs/MeteringSignalProvider';

describe('MeteringSignalProvider', () => {
  let provider!: MeteringSignalProvider;
  let mockUsageStorage!: UsageStorage;

  beforeEach(() => {
    mockUsageStorage = {
      getUsage: vi.fn(),
    };
    provider = new MeteringSignalProvider(mockUsageStorage);
  });

  it('should have category as usage', () => {
    expect(provider.category).toBe('usage');
  });

  it('should collect usage signals', async () => {
    const mockUsageData = {
      tenantId: 'tenant-1',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-31'),
      usage: 5,
      limit: 10,
      features: [
        { key: 'projects', usage: 3, limit: 5 },
        { key: 'teams', usage: 2, limit: 10 },
      ],
    };

    vi.spyOn(mockUsageStorage, 'getUsage').mockResolvedValue(mockUsageData);

    const signals = await provider.collect('tenant-1');

    expect(signals).toHaveLength(3);
    expect(signals[0].category).toBe('usage');
    expect(signals[0].name).toBe('overall_usage');
    expect(signals[0].value).toBeGreaterThan(0);
    expect(signals[0].weight).toBe(0.5);
  });

  it('should normalize score to 100 when usage is below 50%', async () => {
    const mockUsageData = {
      tenantId: 'tenant-1',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-31'),
      usage: 4,
      limit: 10,
      features: [],
    };

    vi.spyOn(mockUsageStorage, 'getUsage').mockResolvedValue(mockUsageData);

    const signals = await provider.collect('tenant-1');

    expect(signals[0].value).toBe(100);
  });

  it('should normalize score to 0 when usage exceeds limit', async () => {
    const mockUsageData = {
      tenantId: 'tenant-1',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-31'),
      usage: 12,
      limit: 10,
      features: [],
    };

    vi.spyOn(mockUsageStorage, 'getUsage').mockResolvedValue(mockUsageData);

    const signals = await provider.collect('tenant-1');

    expect(signals[0].value).toBeLessThanOrEqual(0);
  });

  it('should handle zero limit correctly', async () => {
    const mockUsageData = {
      tenantId: 'tenant-1',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-31'),
      usage: 5,
      limit: 0,
      features: [],
    };

    vi.spyOn(mockUsageStorage, 'getUsage').mockResolvedValue(mockUsageData);

    const signals = await provider.collect('tenant-1');

    expect(signals[0].value).toBe(100);
  });

  it('should collect feature usage signals', async () => {
    const mockUsageData = {
      tenantId: 'tenant-1',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-31'),
      usage: 5,
      limit: 10,
      features: [
        { key: 'projects', usage: 4, limit: 5 },
        { key: 'teams', usage: 8, limit: 10 },
      ],
    };

    vi.spyOn(mockUsageStorage, 'getUsage').mockResolvedValue(mockUsageData);

    const signals = await provider.collect('tenant-1');

    expect(signals).toHaveLength(3);
    expect(signals[1].name).toBe('feature_projects');
    expect(signals[2].name).toBe('feature_teams');
  });
});
