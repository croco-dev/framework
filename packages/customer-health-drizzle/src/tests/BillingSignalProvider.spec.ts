import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@croco/customer-health-core', () => ({
  SignalProvider: class {},
}));

import type { SubscriptionStorage } from '../libs/BillingSignalProvider';
import { BillingSignalProvider } from '../libs/BillingSignalProvider';

describe('BillingSignalProvider', () => {
  let provider!: BillingSignalProvider;
  let mockSubscriptionStorage!: SubscriptionStorage;

  beforeEach(() => {
    mockSubscriptionStorage = {
      getSubscription: vi.fn(),
    };
    provider = new BillingSignalProvider(mockSubscriptionStorage);
  });

  it('should have category as business', () => {
    expect(provider.category).toBe('business');
  });

  it('should return score 100 for active subscription', async () => {
    const mockSubscription = {
      tenantId: 'tenant-1',
      status: 'active' as const,
      planId: 'pro-plan',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: new Date('2026-04-01'),
      cancelAtPeriodEnd: false,
    };

    vi.spyOn(mockSubscriptionStorage, 'getSubscription').mockResolvedValue(mockSubscription);

    const signals = await provider.collect('tenant-1');

    expect(signals).toHaveLength(1);
    expect(signals[0].category).toBe('business');
    expect(signals[0].name).toBe('subscription_status');
    expect(signals[0].value).toBe(100);
    expect(signals[0].weight).toBe(0.7);
  });

  it('should return score 80 for trialing subscription', async () => {
    const mockSubscription = {
      tenantId: 'tenant-1',
      status: 'trialing' as const,
      planId: 'trial-plan',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: new Date('2026-04-01'),
      cancelAtPeriodEnd: false,
    };

    vi.spyOn(mockSubscriptionStorage, 'getSubscription').mockResolvedValue(mockSubscription);

    const signals = await provider.collect('tenant-1');

    expect(signals[0].value).toBe(80);
  });

  it('should return score 30 for past_due subscription', async () => {
    const mockSubscription = {
      tenantId: 'tenant-1',
      status: 'past_due' as const,
      planId: 'pro-plan',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: new Date('2026-04-01'),
      cancelAtPeriodEnd: false,
    };

    vi.spyOn(mockSubscriptionStorage, 'getSubscription').mockResolvedValue(mockSubscription);

    const signals = await provider.collect('tenant-1');

    expect(signals[0].value).toBe(30);
  });

  it('should return score 0 for canceled subscription', async () => {
    const mockSubscription = {
      tenantId: 'tenant-1',
      status: 'canceled' as const,
      planId: 'pro-plan',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: new Date('2026-04-01'),
      cancelAtPeriodEnd: false,
    };

    vi.spyOn(mockSubscriptionStorage, 'getSubscription').mockResolvedValue(mockSubscription);

    const signals = await provider.collect('tenant-1');

    expect(signals[0].value).toBe(0);
  });

  it('should return score 0 when subscription is null', async () => {
    vi.spyOn(mockSubscriptionStorage, 'getSubscription').mockResolvedValue(null);

    const signals = await provider.collect('tenant-1');

    expect(signals).toHaveLength(1);
    expect(signals[0].value).toBe(0);
    expect(signals[0].rawValue).toEqual({ status: null, hasSubscription: false });
  });

  it('should include cancellation scheduled signal when cancelAtPeriodEnd is true', async () => {
    const mockSubscription = {
      tenantId: 'tenant-1',
      status: 'active' as const,
      planId: 'pro-plan',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: new Date('2026-04-01'),
      cancelAtPeriodEnd: true,
    };

    vi.spyOn(mockSubscriptionStorage, 'getSubscription').mockResolvedValue(mockSubscription);

    const signals = await provider.collect('tenant-1');

    expect(signals).toHaveLength(2);
    expect(signals[0].name).toBe('subscription_status');
    expect(signals[1].name).toBe('cancellation_scheduled');
    expect(signals[1].value).toBe(50);
    expect(signals[1].rawValue).toEqual({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: mockSubscription.currentPeriodEnd,
    });
  });

  it('should not include cancellation scheduled signal when cancelAtPeriodEnd is false', async () => {
    const mockSubscription = {
      tenantId: 'tenant-1',
      status: 'active' as const,
      planId: 'pro-plan',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: new Date('2026-04-01'),
      cancelAtPeriodEnd: false,
    };

    vi.spyOn(mockSubscriptionStorage, 'getSubscription').mockResolvedValue(mockSubscription);

    const signals = await provider.collect('tenant-1');

    expect(signals).toHaveLength(1);
    expect(signals[0].name).toBe('subscription_status');
  });
});
