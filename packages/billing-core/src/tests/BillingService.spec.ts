import type { EventPublisher } from '@croco/events-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BillingGateway, CheckoutResult } from '../libs/BillingGateway';
import { BillingService } from '../libs/BillingService';
import { InMemoryBillingStore } from '../libs/InMemoryBillingStore';
import type { Subscription } from '../types';

describe('BillingService', () => {
  let store!: InMemoryBillingStore;
  let mockGateway!: BillingGateway;
  let service!: BillingService;

  beforeEach(() => {
    store = new InMemoryBillingStore();
    mockGateway = {
      ensureCustomer: vi.fn(),
      createCheckout: vi.fn(),
      cancelSubscription: vi.fn(),
      resumeSubscription: vi.fn(),
      getCustomerPortalUrl: vi.fn(),
    };
    service = new BillingService({
      store,
      gateway: mockGateway,
    });
  });

  describe('hasActiveSubscription', () => {
    it('should return false when no subscription exists', async () => {
      const result = await service.hasActiveSubscription('tenant-1');
      expect(result).toBe(false);
    });

    it('should return true when subscription status is active', async () => {
      const subscription: Subscription = {
        id: 'sub-1',
        billingAccountId: 'tenant-1',
        externalSubscriptionId: 'ext-sub-1',
        planId: 'plan-pro',
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      const result = await service.hasActiveSubscription('tenant-1');
      expect(result).toBe(true);
    });

    it('should return true when subscription status is trialing', async () => {
      const subscription: Subscription = {
        id: 'sub-1',
        billingAccountId: 'tenant-1',
        externalSubscriptionId: 'ext-sub-1',
        planId: 'plan-pro',
        status: 'trialing',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      const result = await service.hasActiveSubscription('tenant-1');
      expect(result).toBe(true);
    });

    it('should return false when subscription status is canceled', async () => {
      const subscription: Subscription = {
        id: 'sub-1',
        billingAccountId: 'tenant-1',
        externalSubscriptionId: 'ext-sub-1',
        planId: 'plan-pro',
        status: 'canceled',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      const result = await service.hasActiveSubscription('tenant-1');
      expect(result).toBe(false);
    });

    it('should return false when subscription status is past_due', async () => {
      const subscription: Subscription = {
        id: 'sub-1',
        billingAccountId: 'tenant-1',
        externalSubscriptionId: 'ext-sub-1',
        planId: 'plan-pro',
        status: 'past_due',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      const result = await service.hasActiveSubscription('tenant-1');
      expect(result).toBe(false);
    });

    it('should return false when subscription status is revoked', async () => {
      const subscription: Subscription = {
        id: 'sub-1',
        billingAccountId: 'tenant-1',
        externalSubscriptionId: 'ext-sub-1',
        planId: 'plan-pro',
        status: 'revoked',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      const result = await service.hasActiveSubscription('tenant-1');
      expect(result).toBe(false);
    });
  });

  describe('getSubscriptionStatus', () => {
    it('should return null when no subscription exists', async () => {
      const result = await service.getSubscriptionStatus('tenant-1');
      expect(result).toBeNull();
    });

    it('should return subscription status when subscription exists', async () => {
      const subscription: Subscription = {
        id: 'sub-1',
        billingAccountId: 'tenant-1',
        externalSubscriptionId: 'ext-sub-1',
        planId: 'plan-pro',
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      const result = await service.getSubscriptionStatus('tenant-1');
      expect(result).toBe('active');
    });
  });

  describe('getSubscription', () => {
    it('should return null when no subscription exists', async () => {
      const result = await service.getSubscription('tenant-1');
      expect(result).toBeNull();
    });

    it('should return subscription when it exists', async () => {
      const subscription: Subscription = {
        id: 'sub-1',
        billingAccountId: 'tenant-1',
        externalSubscriptionId: 'ext-sub-1',
        planId: 'plan-pro',
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      const result = await service.getSubscription('tenant-1');
      expect(result).toEqual(subscription);
    });
  });

  describe('createCheckout', () => {
    it('should create new customer and return checkout URL', async () => {
      const params = {
        billingAccountId: 'tenant-1',
        email: 'test@example.com',
        productId: 'product-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      const mockCheckoutResult: CheckoutResult = {
        checkoutUrl: 'https://checkout.example.com/abc123',
        checkoutId: 'checkout-1',
      };

      vi.mocked(mockGateway.ensureCustomer).mockResolvedValue('ext-cust-1');
      vi.mocked(mockGateway.createCheckout).mockResolvedValue(mockCheckoutResult);

      const result = await service.createCheckout(params);

      expect(mockGateway.ensureCustomer).toHaveBeenCalledWith('tenant-1', 'test@example.com');
      expect(mockGateway.createCheckout).toHaveBeenCalledWith(params);
      expect(result).toEqual({ checkoutUrl: 'https://checkout.example.com/abc123' });

      const account = await store.findAccountByTenantId('tenant-1');
      expect(account).toEqual({
        id: 'tenant-1',
        externalCustomerId: 'ext-cust-1',
        email: 'test@example.com',
        createdAt: expect.any(Date),
      });
    });

    it('should use existing customer and return checkout URL', async () => {
      await store.saveAccount({
        id: 'tenant-1',
        externalCustomerId: 'ext-cust-1',
        email: 'test@example.com',
        createdAt: new Date(),
      });

      const params = {
        billingAccountId: 'tenant-1',
        email: 'test@example.com',
        productId: 'product-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      const mockCheckoutResult: CheckoutResult = {
        checkoutUrl: 'https://checkout.example.com/abc123',
        checkoutId: 'checkout-1',
      };

      vi.mocked(mockGateway.createCheckout).mockResolvedValue(mockCheckoutResult);

      const result = await service.createCheckout(params);

      expect(mockGateway.ensureCustomer).not.toHaveBeenCalled();
      expect(mockGateway.createCheckout).toHaveBeenCalledWith(params);
      expect(result).toEqual({ checkoutUrl: 'https://checkout.example.com/abc123' });
    });

    it('BUG-09 should rollback created account when checkout creation fails', async () => {
      const params = {
        billingAccountId: 'tenant-bug-09',
        email: 'bug09@example.com',
        productId: 'product-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      vi.mocked(mockGateway.ensureCustomer).mockResolvedValue('ext-cust-bug-09');
      vi.mocked(mockGateway.createCheckout).mockRejectedValue(new Error('payment failed'));

      await expect(service.createCheckout(params)).rejects.toThrow(
        'Failed to create checkout for tenant tenant-bug-09: payment failed'
      );

      const account = await store.findAccountByTenantId('tenant-bug-09');
      expect(account).toBeNull();
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end and update status', async () => {
      const subscription: Subscription = {
        id: 'sub-1',
        billingAccountId: 'tenant-1',
        externalSubscriptionId: 'ext-sub-1',
        planId: 'plan-pro',
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      await service.cancelSubscription('tenant-1', false);

      expect(mockGateway.cancelSubscription).toHaveBeenCalledWith('ext-sub-1', false);

      const updatedSubscription = await store.findSubscription('tenant-1');
      expect(updatedSubscription?.cancelAtPeriodEnd).toBe(true);
      expect(updatedSubscription?.status).toBe('active');
      expect(updatedSubscription?.lastSyncedAt).toBeInstanceOf(Date);
    });

    it('should cancel subscription immediately and update status', async () => {
      const subscription: Subscription = {
        id: 'sub-1',
        billingAccountId: 'tenant-1',
        externalSubscriptionId: 'ext-sub-1',
        planId: 'plan-pro',
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      await service.cancelSubscription('tenant-1', true);

      expect(mockGateway.cancelSubscription).toHaveBeenCalledWith('ext-sub-1', true);

      const updatedSubscription = await store.findSubscription('tenant-1');
      expect(updatedSubscription?.cancelAtPeriodEnd).toBe(false);
      expect(updatedSubscription?.status).toBe('canceled');
      expect(updatedSubscription?.lastSyncedAt).toBeInstanceOf(Date);
    });

    it('should throw error when no subscription exists', async () => {
      await expect(service.cancelSubscription('tenant-1')).rejects.toThrow(
        "No subscription found for tenant 'tenant-1'"
      );
    });

    it('should publish SubscriptionCanceledEvent when eventPublisher is provided', async () => {
      const mockEventPublisher = {
        publish: vi.fn(),
        publishMany: vi.fn(),
      };

      const serviceWithPublisher = new BillingService({
        store,
        gateway: mockGateway,
        eventPublisher: mockEventPublisher as unknown as EventPublisher,
      });

      const subscription: Subscription = {
        id: 'sub-1',
        billingAccountId: 'tenant-1',
        externalSubscriptionId: 'ext-sub-1',
        planId: 'plan-pro',
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      await serviceWithPublisher.cancelSubscription('tenant-1', false);

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          externalSubscriptionId: 'ext-sub-1',
          cancelAtPeriodEnd: true,
        })
      );
    });
  });

  describe('resumeSubscription', () => {
    it('should resume subscription and set cancelAtPeriodEnd to false', async () => {
      const subscription: Subscription = {
        id: 'sub-1',
        billingAccountId: 'tenant-1',
        externalSubscriptionId: 'ext-sub-1',
        planId: 'plan-pro',
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: true,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      await service.resumeSubscription('tenant-1');

      expect(mockGateway.resumeSubscription).toHaveBeenCalledWith('ext-sub-1');

      const updatedSubscription = await store.findSubscription('tenant-1');
      expect(updatedSubscription?.cancelAtPeriodEnd).toBe(false);
      expect(updatedSubscription?.lastSyncedAt).toBeInstanceOf(Date);
    });

    it('should throw error when no subscription exists', async () => {
      await expect(service.resumeSubscription('tenant-1')).rejects.toThrow(
        "No subscription found for tenant 'tenant-1'"
      );
    });
  });

  describe('getCustomerPortalUrl', () => {
    it('should return customer portal URL', async () => {
      await store.saveAccount({
        id: 'tenant-1',
        externalCustomerId: 'ext-cust-1',
        email: 'test@example.com',
        createdAt: new Date(),
      });

      vi.mocked(mockGateway.getCustomerPortalUrl).mockResolvedValue('https://portal.example.com/customer');

      const result = await service.getCustomerPortalUrl('tenant-1');

      expect(mockGateway.getCustomerPortalUrl).toHaveBeenCalledWith('ext-cust-1');
      expect(result).toBe('https://portal.example.com/customer');
    });

    it('should throw error when no billing account exists', async () => {
      await expect(service.getCustomerPortalUrl('tenant-1')).rejects.toThrow(
        "No billing account found for tenant 'tenant-1'"
      );
    });
  });
});
