import type { BillingStore, Plan, PlanRegistry } from '@croco/billing-core';
import { OrderPaidEvent, PlanChangedEvent, SubscriptionCanceledEvent } from '@croco/billing-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingEventHandler } from '../libs/handlers/BillingEventHandler';
import type { MetricsRepository } from '../libs/interfaces/MetricsRepository';
import type { MRRMovement } from '../types';

describe('BillingEventHandler', () => {
  let handler!: BillingEventHandler;
  let planRegistry!: PlanRegistry;
  let billingStore!: BillingStore;
  let metricsRepository!: MetricsRepository;

  const mockPlan: Plan = {
    id: 'plan-pro',
    name: 'Pro Plan',
    amount: 2900,
    currency: 'USD',
    interval: 'month',
    intervalCount: 1,
  };

  const mockPlanYearly: Plan = {
    id: 'plan-pro-yearly',
    name: 'Pro Plan Yearly',
    amount: 29000,
    currency: 'USD',
    interval: 'year',
    intervalCount: 1,
  };

  const mockAccount = {
    id: 'account-1',
    externalCustomerId: 'cus-stripe',
    email: 'test@example.com',
    createdAt: new Date(),
  };

  const mockSubscription = {
    id: 'sub-1',
    billingAccountId: 'account-1',
    externalSubscriptionId: 'sub-stripe',
    planId: 'plan-pro',
    status: 'active' as const,
    currentPeriodEnd: new Date(),
    cancelAtPeriodEnd: false,
    lastSyncedAt: new Date(),
  };

  beforeEach(() => {
    planRegistry = {
      getPlan: vi.fn(),
      getAllPlans: vi.fn(),
      getPlanAtDate: vi.fn(),
    } as unknown as PlanRegistry;

    billingStore = {
      findAccountByTenantId: vi.fn(),
      findAccountByExternalId: vi.fn(),
      saveAccount: vi.fn(),
      findSubscription: vi.fn(),
      findSubscriptionByExternalId: vi.fn(),
      saveSubscription: vi.fn(),
      saveOrder: vi.fn(),
      findOrdersByAccount: vi.fn(),
      isWebhookProcessed: vi.fn(),
      markWebhookProcessed: vi.fn(),
    } as unknown as BillingStore;

    metricsRepository = {
      recordMRRMovement: vi.fn(),
      recordSnapshot: vi.fn(),
      getSnapshot: vi.fn(),
      getMRRHistory: vi.fn(),
      getRetentionMetrics: vi.fn(),
    } as unknown as MetricsRepository;

    handler = new BillingEventHandler(planRegistry, billingStore, metricsRepository);
  });

  describe('OrderPaidEvent', () => {
    it('should record new MRR when order is paid', async () => {
      const event = new OrderPaidEvent('tenant-1', 'order-1', 2900, 'USD');

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscription).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockResolvedValue(mockPlan);

      await handler.handle(event);

      const expectedMovement: MRRMovement = {
        new: { amount: 2900, currency: 'USD' },
        expansion: { amount: 0, currency: 'USD' },
        contraction: { amount: 0, currency: 'USD' },
        churned: { amount: 0, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: 2900, currency: 'USD' },
      };

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledWith('tenant-1', expectedMovement, expect.any(Date));
    });

    it('should normalize yearly plan to monthly MRR', async () => {
      const event = new OrderPaidEvent('tenant-1', 'order-1', 29000, 'USD');

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscription).mockResolvedValue({
        ...mockSubscription,
        planId: 'plan-pro-yearly',
      });
      vi.mocked(planRegistry.getPlan).mockResolvedValue(mockPlanYearly);

      await handler.handle(event);

      const callArgs = vi.mocked(metricsRepository.recordMRRMovement).mock.calls[0];
      const movement = callArgs[1];

      expect(movement.new.amount).toBeCloseTo(2416.67, 2);
    });

    it('should be idempotent - ignore duplicate events', async () => {
      const event = new OrderPaidEvent('tenant-1', 'order-1', 2900, 'USD');

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscription).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockResolvedValue(mockPlan);

      await handler.handle(event);
      await handler.handle(event);

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledTimes(1);
    });

    it('should skip if account not found', async () => {
      const event = new OrderPaidEvent('tenant-1', 'order-1', 2900, 'USD');

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(null);

      await handler.handle(event);

      expect(metricsRepository.recordMRRMovement).not.toHaveBeenCalled();
    });
  });

  describe('PlanChangedEvent', () => {
    it('should record expansion MRR when upgrading plan', async () => {
      const event = new PlanChangedEvent('tenant-1', 'plan-basic', 'plan-pro', 'sub-stripe');

      const basicPlan: Plan = {
        id: 'plan-basic',
        name: 'Basic Plan',
        amount: 900,
        currency: 'USD',
        interval: 'month',
        intervalCount: 1,
      };

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockImplementation((id) => {
        if (id === 'plan-basic') return Promise.resolve(basicPlan);
        if (id === 'plan-pro') return Promise.resolve(mockPlan);
        return Promise.resolve(null);
      });

      await handler.handle(event);

      const callArgs = vi.mocked(metricsRepository.recordMRRMovement).mock.calls[0];
      const movement = callArgs[1];

      expect(movement.expansion.amount).toBe(2000);
      expect(movement.net.amount).toBe(2000);
    });

    it('should record contraction MRR when downgrading plan', async () => {
      const event = new PlanChangedEvent('tenant-1', 'plan-pro', 'plan-basic', 'sub-stripe');

      const basicPlan: Plan = {
        id: 'plan-basic',
        name: 'Basic Plan',
        amount: 900,
        currency: 'USD',
        interval: 'month',
        intervalCount: 1,
      };

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockImplementation((id) => {
        if (id === 'plan-basic') return Promise.resolve(basicPlan);
        if (id === 'plan-pro') return Promise.resolve(mockPlan);
        return Promise.resolve(null);
      });

      await handler.handle(event);

      const callArgs = vi.mocked(metricsRepository.recordMRRMovement).mock.calls[0];
      const movement = callArgs[1];

      expect(movement.contraction.amount).toBe(2000);
      expect(movement.net.amount).toBe(-2000);
    });

    it('should be idempotent', async () => {
      const event = new PlanChangedEvent('tenant-1', 'plan-basic', 'plan-pro', 'sub-stripe');

      const basicPlan: Plan = {
        id: 'plan-basic',
        name: 'Basic Plan',
        amount: 900,
        currency: 'USD',
        interval: 'month',
        intervalCount: 1,
      };

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockImplementation((id) => {
        if (id === 'plan-basic') return Promise.resolve(basicPlan);
        if (id === 'plan-pro') return Promise.resolve(mockPlan);
        return Promise.resolve(null);
      });

      await handler.handle(event);
      await handler.handle(event);

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledTimes(1);
    });
  });

  describe('SubscriptionCanceledEvent', () => {
    it('should record churned MRR when subscription is canceled', async () => {
      const event = new SubscriptionCanceledEvent('tenant-1', 'sub-stripe', false);

      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockResolvedValue(mockPlan);

      await handler.handle(event);

      const expectedMovement: MRRMovement = {
        new: { amount: 0, currency: 'USD' },
        expansion: { amount: 0, currency: 'USD' },
        contraction: { amount: 0, currency: 'USD' },
        churned: { amount: 2900, currency: 'USD' },
        reactivation: { amount: 0, currency: 'USD' },
        net: { amount: -2900, currency: 'USD' },
      };

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledWith('tenant-1', expectedMovement, expect.any(Date));
    });

    it('should be idempotent', async () => {
      const event = new SubscriptionCanceledEvent('tenant-1', 'sub-stripe', false);

      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockResolvedValue(mockPlan);

      await handler.handle(event);
      await handler.handle(event);

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledTimes(1);
    });

    it('should skip if subscription not found', async () => {
      const event = new SubscriptionCanceledEvent('tenant-1', 'sub-stripe', false);

      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(null);

      await handler.handle(event);

      expect(metricsRepository.recordMRRMovement).not.toHaveBeenCalled();
    });
  });
});
