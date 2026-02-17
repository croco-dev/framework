import type { BillingStore } from '@croco/billing-core';
import type { EventPublisher } from '@croco/events-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PolarWebhookHandler } from '../libs/PolarWebhookHandler';
import type { PolarConfig } from '../types';

function createMockStore(): BillingStore {
  return {
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
  };
}

function createMockEventPublisher(): EventPublisher {
  const mockPublisher = {
    publish: vi.fn(),
    publishMany: vi.fn(),
  } as unknown as EventPublisher;
  return mockPublisher;
}

const mockValidateEvent = vi.fn();

vi.mock('@polar-sh/sdk/dist/esm/webhooks.js', () => ({
  get validateEvent() {
    return mockValidateEvent;
  },
  WebhookVerificationError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'WebhookVerificationError';
    }
  },
}));

describe('PolarWebhookHandler', () => {
  let handler!: PolarWebhookHandler;
  let mockStore: BillingStore;
  let mockEventPublisher: EventPublisher;
  let config: PolarConfig;

  beforeEach(() => {
    mockStore = createMockStore();
    mockEventPublisher = createMockEventPublisher();
    config = {
      accessToken: 'test-token',
      environment: 'sandbox',
      webhookSecret: 'test-secret',
    };

    handler = new PolarWebhookHandler(config, {
      store: mockStore,
      eventPublisher: mockEventPublisher,
    });

    vi.clearAllMocks();
  });

  describe('이미 처리된 이벤트는 스킵 (멱등성)', () => {
    it('이미 처리된 webhook 이벤트는 다시 처리하지 않음', async () => {
      vi.mocked(mockStore.isWebhookProcessed).mockResolvedValue(true);

      const eventData = {
        id: 'evt-123',
        type: 'subscription.created',
        data: {},
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const body = JSON.stringify(eventData);
      const headers = { 'webhook-id': 'evt-123', 'webhook-signature': 'sig-123' };

      const result = await handler.handle(body, headers);

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('evt-123');
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
      expect(mockStore.markWebhookProcessed).not.toHaveBeenCalled();
    });

    it('should process webhook only once for concurrent requests', async () => {
      vi.mocked(mockStore.isWebhookProcessed).mockResolvedValue(false);
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
      vi.mocked(mockStore.markWebhookProcessed).mockResolvedValue(undefined);
      vi.mocked(mockStore.saveSubscription).mockImplementation(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
      });

      const eventData = {
        id: 'evt-race-1',
        type: 'subscription.created',
        data: {
          id: 'sub-race-1',
          customer: { externalId: 'tenant-race-1', metadata: {} },
          product: { id: 'plan-pro' },
          status: 'active',
          currentPeriodEnd: '2026-02-01T00:00:00Z',
          cancelAtPeriodEnd: false,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const body = JSON.stringify(eventData);
      const headers = { 'webhook-id': 'evt-race-1' };
      const secondHandler = new PolarWebhookHandler(config, {
        store: mockStore,
        eventPublisher: mockEventPublisher,
      });

      const [firstResult, secondResult] = await Promise.all([
        handler.handle(body, headers),
        secondHandler.handle(body, headers),
      ]);

      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);
      expect(firstResult.eventId).toBe('evt-race-1');
      expect(secondResult.eventId).toBe('evt-race-1');
      expect(mockStore.saveSubscription).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(1);
      expect(mockStore.markWebhookProcessed).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscription 이벤트 처리', () => {
    beforeEach(() => {
      vi.mocked(mockStore.isWebhookProcessed).mockResolvedValue(false);
      vi.mocked(mockStore.markWebhookProcessed).mockResolvedValue(undefined);
    });

    it('subscription.created 이벤트 처리 → store 업데이트 + 이벤트 발행', async () => {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);

      const eventData = {
        id: 'evt-123',
        type: 'subscription.created',
        data: {
          id: 'sub-123',
          customer: { externalId: 'tenant-123', metadata: {} },
          product: { id: 'plan-pro' },
          status: 'active',
          currentPeriodEnd: '2026-02-01T00:00:00Z',
          cancelAtPeriodEnd: false,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const body = JSON.stringify(eventData);
      const headers = { 'webhook-id': 'evt-123' };

      const result = await handler.handle(body, headers);

      expect(result.success).toBe(true);
      expect(mockStore.saveSubscription).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalled();
      expect(mockStore.markWebhookProcessed).toHaveBeenCalledWith({
        eventId: 'evt-123',
        eventType: 'subscription.created',
        processedAt: expect.any(Date),
      });
    });

    it('should throw error if currentPeriodEnd is missing', async () => {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);

      const eventData = {
        id: 'evt-null-period',
        type: 'subscription.created',
        data: {
          id: 'sub-null-period',
          customer: { externalId: 'tenant-123', metadata: {} },
          product: { id: 'plan-pro' },
          status: 'active',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const result = await handler.handle(JSON.stringify(eventData), { 'webhook-id': 'evt-null-period' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('currentPeriodEnd is required');
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockStore.markWebhookProcessed).not.toHaveBeenCalled();
    });

    it('should throw error for unknown status', async () => {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);

      const eventData = {
        id: 'evt-unknown-status',
        type: 'subscription.created',
        data: {
          id: 'sub-unknown-status',
          customer: { externalId: 'tenant-123', metadata: {} },
          product: { id: 'plan-pro' },
          status: 'future_status',
          currentPeriodEnd: '2026-02-01T00:00:00Z',
          cancelAtPeriodEnd: false,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const result = await handler.handle(JSON.stringify(eventData), { 'webhook-id': 'evt-unknown-status' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown Polar status: future_status');
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockStore.markWebhookProcessed).not.toHaveBeenCalled();
    });
  });

  describe('order 이벤트 처리', () => {
    beforeEach(() => {
      vi.mocked(mockStore.isWebhookProcessed).mockResolvedValue(false);
      vi.mocked(mockStore.markWebhookProcessed).mockResolvedValue(undefined);
    });

    it('order.paid 이벤트 처리 → store 저장 + 이벤트 발행', async () => {
      const eventData = {
        id: 'evt-456',
        type: 'order.paid',
        data: {
          id: 'order-123',
          amount: 9900,
          currency: 'USD',
          customer: { externalId: 'tenant-123', metadata: {} },
          createdAt: '2026-01-31T00:00:00Z',
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const body = JSON.stringify(eventData);
      const headers = { 'webhook-id': 'evt-456' };

      const result = await handler.handle(body, headers);

      expect(result.success).toBe(true);
      expect(mockStore.saveOrder).toHaveBeenCalledWith({
        id: 'order-123',
        billingAccountId: 'tenant-123',
        externalOrderId: 'order-123',
        amount: 9900,
        currency: 'USD',
        reason: 'subscription_cycle',
        paidAt: expect.any(Date),
      });
      expect(mockEventPublisher.publish).toHaveBeenCalled();
      expect(mockStore.markWebhookProcessed).toHaveBeenCalledWith({
        eventId: 'evt-456',
        eventType: 'order.paid',
        processedAt: expect.any(Date),
      });
    });
  });

  describe('webhook 검증 실패', () => {
    it('잘못된 서명으로 인해 검증 실패', async () => {
      vi.mocked(mockStore.isWebhookProcessed).mockResolvedValue(false);

      const body = JSON.stringify({ id: 'evt-789', type: 'subscription.created' });
      const headers = { 'webhook-id': 'evt-789', 'webhook-signature': 'invalid-signature' };

      const WebhookVerificationError = class extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'WebhookVerificationError';
        }
      };

      vi.mocked(mockValidateEvent).mockImplementation(() => {
        throw new WebhookVerificationError('Invalid signature');
      });

      const result = await handler.handle(body, headers);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Webhook verification failed');
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
    });

    it('이벤트 ID 또는 타입 누락 시 실패', async () => {
      vi.mocked(mockStore.isWebhookProcessed).mockResolvedValue(false);

      const body = JSON.stringify({});
      const headers = { 'webhook-id': 'evt-999' };

      vi.mocked(mockValidateEvent).mockReturnValue({
        id: null,
        type: null,
      } as never);

      const result = await handler.handle(body, headers);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing event ID or type');
    });
  });

  describe('처리 완료 후 markWebhookProcessed 호출', () => {
    it('성공적인 이벤트 처리 후 webhook 처리 기록 저장', async () => {
      vi.mocked(mockStore.isWebhookProcessed).mockResolvedValue(false);
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
      vi.mocked(mockStore.markWebhookProcessed).mockResolvedValue(undefined);

      const eventData = {
        id: 'evt-999',
        type: 'subscription.canceled',
        data: {
          id: 'sub-999',
          customer: { externalId: 'tenant-999', metadata: {} },
          product: { id: 'plan-basic' },
          status: 'canceled',
          currentPeriodEnd: '2026-02-01T00:00:00Z',
          cancelAtPeriodEnd: true,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const body = JSON.stringify(eventData);
      const headers = { 'webhook-id': 'evt-999' };

      const result = await handler.handle(body, headers);

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('evt-999');
      expect(mockStore.markWebhookProcessed).toHaveBeenCalledTimes(1);
      expect(mockStore.markWebhookProcessed).toHaveBeenCalledWith({
        eventId: 'evt-999',
        eventType: 'subscription.canceled',
        processedAt: expect.any(Date),
      });
    });
  });
});
