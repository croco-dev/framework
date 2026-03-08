import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBillingStore } from '../libs/InMemoryBillingStore';
import { WebhookAlreadyProcessedProblem } from '../libs/problems/BillingProblems';
import type { BillingAccount, Order, ProcessedWebhook, Subscription } from '../types';

describe('InMemoryBillingStore', () => {
  let store!: InMemoryBillingStore;

  beforeEach(() => {
    store = new InMemoryBillingStore();
  });

  describe('findAccountByTenantId', () => {
    it('should return null when account does not exist', async () => {
      const result = await store.findAccountByTenantId('non-existent');
      expect(result).toBeNull();
    });

    it('should return account when it exists', async () => {
      const account: BillingAccount = {
        id: 'tenant-1',
        tenantId: 'tenant-1',
        externalCustomerId: 'ext-cust-1',
        email: 'test@example.com',
        createdAt: new Date(),
      };
      await store.saveAccount(account);

      const result = await store.findAccountByTenantId('tenant-1');
      expect(result).toEqual(account);
    });
  });

  describe('saveAccount and findAccountByExternalId', () => {
    it('should save account and find by external ID', async () => {
      const account: BillingAccount = {
        id: 'tenant-1',
        tenantId: 'tenant-1',
        externalCustomerId: 'ext-cust-1',
        email: 'test@example.com',
        createdAt: new Date(),
      };
      await store.saveAccount(account);

      const result = await store.findAccountByExternalId('ext-cust-1');
      expect(result).toEqual(account);
    });

    it('should return null when finding by non-existent external ID', async () => {
      const result = await store.findAccountByExternalId('non-existent');
      expect(result).toBeNull();
    });

    it('should remove stale external ID mappings when an account is re-saved with a new external ID', async () => {
      const originalAccount: BillingAccount = {
        id: 'tenant-1',
        tenantId: 'tenant-1',
        externalCustomerId: 'ext-cust-1',
        email: 'test@example.com',
        createdAt: new Date(),
      };

      await store.saveAccount(originalAccount);

      const updatedAccount: BillingAccount = {
        ...originalAccount,
        externalCustomerId: 'ext-cust-2',
      };

      await store.saveAccount(updatedAccount);

      expect(await store.findAccountByExternalId('ext-cust-1')).toBeNull();
      expect(await store.findAccountByExternalId('ext-cust-2')).toEqual(updatedAccount);
    });
  });

  describe('findSubscription', () => {
    it('should return null when subscription does not exist', async () => {
      const result = await store.findSubscription('non-existent');
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

      const result = await store.findSubscription('tenant-1');
      expect(result).toEqual(subscription);
    });
  });

  describe('saveSubscription and findSubscriptionByExternalId', () => {
    it('should save subscription and find by external ID', async () => {
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

      const result = await store.findSubscriptionByExternalId('ext-sub-1');
      expect(result).toEqual(subscription);
    });

    it('should return null when finding by non-existent external subscription ID', async () => {
      const result = await store.findSubscriptionByExternalId('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('saveOrder and findOrdersByAccount', () => {
    it('should save order and find by account ID', async () => {
      const order1: Order = {
        id: 'order-1',
        billingAccountId: 'tenant-1',
        externalOrderId: 'ext-order-1',
        amount: 1000,
        currency: 'USD',
        reason: 'subscription_cycle',
        paidAt: new Date(),
      };
      const order2: Order = {
        id: 'order-2',
        billingAccountId: 'tenant-1',
        externalOrderId: 'ext-order-2',
        amount: 2000,
        currency: 'USD',
        reason: 'one_time',
        paidAt: new Date(),
      };

      await store.saveOrder(order1);
      await store.saveOrder(order2);

      const result = await store.findOrdersByAccount('tenant-1');
      expect(result).toHaveLength(2);
      expect(result).toEqual([order1, order2]);
    });

    it('should return empty array when no orders exist', async () => {
      const result = await store.findOrdersByAccount('non-existent');
      expect(result).toEqual([]);
    });

    it('should only return orders for specific account', async () => {
      const order1: Order = {
        id: 'order-1',
        billingAccountId: 'tenant-1',
        externalOrderId: 'ext-order-1',
        amount: 1000,
        currency: 'USD',
        reason: 'subscription_cycle',
        paidAt: new Date(),
      };
      const order2: Order = {
        id: 'order-2',
        billingAccountId: 'tenant-2',
        externalOrderId: 'ext-order-2',
        amount: 2000,
        currency: 'USD',
        reason: 'one_time',
        paidAt: new Date(),
      };

      await store.saveOrder(order1);
      await store.saveOrder(order2);

      const result1 = await store.findOrdersByAccount('tenant-1');
      const result2 = await store.findOrdersByAccount('tenant-2');

      expect(result1).toEqual([order1]);
      expect(result2).toEqual([order2]);
    });
  });

  describe('isWebhookProcessed and markWebhookProcessed', () => {
    it('should return false before webhook is processed', async () => {
      const result = await store.isWebhookProcessed('event-1');
      expect(result).toBe(false);
    });

    it('should return true after webhook is processed', async () => {
      const webhook: ProcessedWebhook = {
        eventId: 'event-1',
        eventType: 'subscription.created',
        processedAt: new Date(),
      };
      await store.markWebhookProcessed(webhook);

      const result = await store.isWebhookProcessed('event-1');
      expect(result).toBe(true);
    });

    it('should reject duplicate webhook claims', async () => {
      const webhook: ProcessedWebhook = {
        eventId: 'event-1',
        eventType: 'subscription.created',
        processedAt: new Date(),
      };

      await store.markWebhookProcessed(webhook);
      await expect(store.markWebhookProcessed(webhook)).rejects.toBeInstanceOf(WebhookAlreadyProcessedProblem);

      const result = await store.isWebhookProcessed('event-1');
      expect(result).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all data', async () => {
      const account: BillingAccount = {
        id: 'tenant-1',
        tenantId: 'tenant-1',
        externalCustomerId: 'ext-cust-1',
        email: 'test@example.com',
        createdAt: new Date(),
      };
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
      const order: Order = {
        id: 'order-1',
        billingAccountId: 'tenant-1',
        externalOrderId: 'ext-order-1',
        amount: 1000,
        currency: 'USD',
        reason: 'subscription_cycle',
        paidAt: new Date(),
      };
      const webhook: ProcessedWebhook = {
        eventId: 'event-1',
        eventType: 'subscription.created',
        processedAt: new Date(),
      };

      await store.saveAccount(account);
      await store.saveSubscription(subscription);
      await store.saveOrder(order);
      await store.markWebhookProcessed(webhook);

      store.reset();

      expect(await store.findAccountByTenantId('tenant-1')).toBeNull();
      expect(await store.findAccountByExternalId('ext-cust-1')).toBeNull();
      expect(await store.findSubscription('tenant-1')).toBeNull();
      expect(await store.findSubscriptionByExternalId('ext-sub-1')).toBeNull();
      expect(await store.findOrdersByAccount('tenant-1')).toEqual([]);
      expect(await store.isWebhookProcessed('event-1')).toBe(false);
    });
  });
});
