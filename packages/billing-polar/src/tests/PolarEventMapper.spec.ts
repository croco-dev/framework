import {
  OrderPaidEvent,
  PlanChangedEvent,
  SubscriptionActivatedEvent,
  SubscriptionCanceledEvent,
  SubscriptionPastDueEvent,
  SubscriptionRevokedEvent,
} from '@croco/billing-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { PolarEventMapper } from '../libs/PolarEventMapper';

describe('PolarEventMapper', () => {
  let mapper!: PolarEventMapper;

  beforeEach(() => {
    mapper = new PolarEventMapper();
  });

  describe('mapSubscriptionEvent', () => {
    it('subscription.created → SubscriptionActivatedEvent', () => {
      const events = mapper.mapSubscriptionEvent('subscription.created', 'tenant-123', {
        id: 'sub-123',
        productId: 'plan-pro',
        status: 'active',
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(SubscriptionActivatedEvent);
      const event = events[0] as SubscriptionActivatedEvent;
      expect(event.tenantId).toBe('tenant-123');
      expect(event.planId).toBe('plan-pro');
      expect(event.externalSubscriptionId).toBe('sub-123');
    });

    it('subscription.active → SubscriptionActivatedEvent', () => {
      const events = mapper.mapSubscriptionEvent('subscription.active', 'tenant-123', {
        id: 'sub-123',
        productId: 'plan-pro',
        status: 'active',
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(SubscriptionActivatedEvent);
      const event = events[0] as SubscriptionActivatedEvent;
      expect(event.tenantId).toBe('tenant-123');
      expect(event.planId).toBe('plan-pro');
      expect(event.externalSubscriptionId).toBe('sub-123');
    });

    it('subscription.updated (플랜 변경) → PlanChangedEvent', () => {
      const events = mapper.mapSubscriptionEvent(
        'subscription.updated',
        'tenant-123',
        {
          id: 'sub-123',
          productId: 'plan-enterprise',
          status: 'active',
        },
        'plan-pro'
      );

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(PlanChangedEvent);
      const event = events[0] as PlanChangedEvent;
      expect(event.tenantId).toBe('tenant-123');
      expect(event.previousPlanId).toBe('plan-pro');
      expect(event.newPlanId).toBe('plan-enterprise');
      expect(event.externalSubscriptionId).toBe('sub-123');
    });

    it('subscription.updated (상태만 변경 - past_due) → SubscriptionPastDueEvent', () => {
      const events = mapper.mapSubscriptionEvent(
        'subscription.updated',
        'tenant-123',
        {
          id: 'sub-123',
          productId: 'plan-pro',
          status: 'past_due',
        },
        'plan-pro'
      );

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(SubscriptionPastDueEvent);
      const event = events[0] as SubscriptionPastDueEvent;
      expect(event.tenantId).toBe('tenant-123');
      expect(event.externalSubscriptionId).toBe('sub-123');
    });

    it('subscription.updated (플랜 변경 + past_due) → PlanChangedEvent + SubscriptionPastDueEvent', () => {
      const events = mapper.mapSubscriptionEvent(
        'subscription.updated',
        'tenant-123',
        {
          id: 'sub-123',
          productId: 'plan-enterprise',
          status: 'past_due',
        },
        'plan-pro'
      );

      expect(events).toHaveLength(2);
      expect(events[0]).toBeInstanceOf(PlanChangedEvent);
      expect(events[1]).toBeInstanceOf(SubscriptionPastDueEvent);
    });

    it('subscription.updated (플랜 변경 없음, 상태도 아님) → 빈 배열', () => {
      const events = mapper.mapSubscriptionEvent(
        'subscription.updated',
        'tenant-123',
        {
          id: 'sub-123',
          productId: 'plan-pro',
          status: 'active',
        },
        'plan-pro'
      );

      expect(events).toHaveLength(0);
    });

    it('subscription.canceled → SubscriptionCanceledEvent', () => {
      const events = mapper.mapSubscriptionEvent('subscription.canceled', 'tenant-123', {
        id: 'sub-123',
        productId: 'plan-pro',
        status: 'canceled',
        cancelAtPeriodEnd: true,
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(SubscriptionCanceledEvent);
      const event = events[0] as SubscriptionCanceledEvent;
      expect(event.tenantId).toBe('tenant-123');
      expect(event.externalSubscriptionId).toBe('sub-123');
      expect(event.cancelAtPeriodEnd).toBe(true);
    });

    it('subscription.revoked → SubscriptionRevokedEvent', () => {
      const events = mapper.mapSubscriptionEvent('subscription.revoked', 'tenant-123', {
        id: 'sub-123',
        productId: 'plan-pro',
        status: 'revoked',
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(SubscriptionRevokedEvent);
      const event = events[0] as SubscriptionRevokedEvent;
      expect(event.tenantId).toBe('tenant-123');
      expect(event.externalSubscriptionId).toBe('sub-123');
    });

    it('subscription.canceled (cancelAtPeriodEnd 미지정) → SubscriptionCanceledEvent (기본값 true)', () => {
      const events = mapper.mapSubscriptionEvent('subscription.canceled', 'tenant-123', {
        id: 'sub-123',
        productId: 'plan-pro',
        status: 'canceled',
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(SubscriptionCanceledEvent);
      const event = events[0] as SubscriptionCanceledEvent;
      expect(event.cancelAtPeriodEnd).toBe(true);
    });
  });

  describe('mapOrderEvent', () => {
    it('order.paid → OrderPaidEvent', () => {
      const events = mapper.mapOrderEvent('order.paid', 'tenant-123', {
        id: 'order-123',
        amount: 9900,
        currency: 'USD',
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(OrderPaidEvent);
      const event = events[0] as OrderPaidEvent;
      expect(event.tenantId).toBe('tenant-123');
      expect(event.externalOrderId).toBe('order-123');
      expect(event.amount).toBe(9900);
      expect(event.currency).toBe('USD');
    });

    it('알 수 없는 order 이벤트 → 빈 배열', () => {
      const events = mapper.mapOrderEvent('order.created', 'tenant-123', {
        id: 'order-123',
        amount: 9900,
        currency: 'USD',
      });

      expect(events).toHaveLength(0);
    });
  });
});
