import type { BillingStore } from '@croco/billing-core';
import type { EventPublisher } from '@croco/events-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { PolarWebhookHandler } from '../libs/PolarWebhookHandler';
import { WebhookValidationProblem } from '../libs/problems/WebhookValidationProblem';
import type { PolarConfig } from '../types';

function createMockStore(): BillingStore {
  return {
    findAccountByTenantId: vi.fn(),
    findAccountByExternalId: vi.fn(),
    saveAccount: vi.fn(),
    deleteAccount: vi.fn(),
    findSubscription: vi.fn(),
    findSubscriptionByExternalId: vi.fn(),
    saveSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
    saveOrder: vi.fn(),
    findOrdersByAccount: vi.fn(),
    reserveWebhook: vi.fn(),
    completeWebhook: vi.fn(),
    failWebhook: vi.fn(),
    isWebhookProcessed: vi.fn(),
    markWebhookProcessed: vi.fn(),
  };
}

function createMockEventPublisher(): EventPublisher {
  const mockPublisher = {
    publish: vi.fn(),
    publishNow: vi.fn(),
    publishMany: vi.fn(),
  } as unknown as EventPublisher;
  return mockPublisher;
}

const mockValidateEvent = vi.fn();

vi.mock('@polar-sh/sdk/webhooks', () => ({
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
  let mockStore!: BillingStore;
  let mockEventPublisher!: EventPublisher;
  let config!: PolarConfig;

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
      expect(mockStore.reserveWebhook).not.toHaveBeenCalled();
    });

    it('should process webhook only once for concurrent requests', async () => {
      vi.mocked(mockStore.isWebhookProcessed).mockResolvedValue(false);
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
      vi.mocked(mockStore.reserveWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.completeWebhook).mockResolvedValue(undefined);
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
      expect(mockEventPublisher.publishNow).toHaveBeenCalledTimes(1);
      expect(mockStore.reserveWebhook).toHaveBeenCalledTimes(1);
      expect(mockStore.completeWebhook).toHaveBeenCalledTimes(1);
    });

    it('reserveWebhook에서 중복 충돌이 나면 이미 처리된 이벤트로 간주하고 스킵', async () => {
      vi.mocked(mockStore.isWebhookProcessed).mockResolvedValue(false);
      vi.mocked(mockStore.reserveWebhook).mockRejectedValue(
        new Error('duplicate key value violates unique constraint "processed_webhooks_event_id_key"')
      );
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);

      const eventData = {
        id: 'evt-dup-conflict',
        type: 'subscription.created',
        data: {
          id: 'sub-dup-conflict',
          customer: { externalId: 'tenant-dup-conflict', metadata: {} },
          product: { id: 'plan-pro' },
          status: 'active',
          currentPeriodEnd: '2026-02-01T00:00:00Z',
          cancelAtPeriodEnd: false,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const result = await handler.handle(JSON.stringify(eventData), { 'webhook-id': 'evt-dup-conflict' });

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('evt-dup-conflict');
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
      expect(mockStore.reserveWebhook).toHaveBeenCalledTimes(1);
      expect(mockStore.completeWebhook).not.toHaveBeenCalled();
    });
  });

  describe('subscription 이벤트 처리', () => {
    beforeEach(() => {
      vi.mocked(mockStore.isWebhookProcessed).mockResolvedValue(false);
      vi.mocked(mockStore.reserveWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.completeWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.failWebhook).mockResolvedValue(undefined);
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
      expect(mockEventPublisher.publishNow).toHaveBeenCalled();
      expect(mockStore.reserveWebhook).toHaveBeenCalledWith('evt-123', 'subscription.created');
      expect(mockStore.completeWebhook).toHaveBeenCalledWith('evt-123');
    });

    it('subscription.canceled에서 currentPeriodEnd가 null이면 실패 처리', async () => {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);

      const eventData = {
        id: 'evt-null-period',
        type: 'subscription.canceled',
        data: {
          id: 'sub-null-period',
          customer: { externalId: 'tenant-123', metadata: {} },
          product: { id: 'plan-pro' },
          status: 'canceled',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: true,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const result = await handler.handle(JSON.stringify(eventData), { 'webhook-id': 'evt-null-period' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('currentPeriodEnd is required');
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockStore.reserveWebhook).not.toHaveBeenCalled();
      expect(mockStore.failWebhook).not.toHaveBeenCalled();
    });

    it('should return a failure result for unknown status', async () => {
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
      expect(result.error).toContain('Event processing failed:');
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockStore.reserveWebhook).not.toHaveBeenCalled();
      expect(mockStore.failWebhook).not.toHaveBeenCalled();
    });

    it('handler 실패 시 reserveWebhook 상태가 fail로 해제되어 재시도 가능', async () => {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
      vi.mocked(mockStore.saveSubscription).mockRejectedValueOnce(new Error('temporary store failure'));

      const eventData = {
        id: 'evt-retryable-failure',
        type: 'subscription.created',
        data: {
          id: 'sub-retryable-failure',
          customer: { externalId: 'tenant-retryable-failure', metadata: {} },
          product: { id: 'plan-pro' },
          status: 'active',
          currentPeriodEnd: '2026-02-01T00:00:00Z',
          cancelAtPeriodEnd: false,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const result = await handler.handle(JSON.stringify(eventData), { 'webhook-id': 'evt-retryable-failure' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('temporary store failure');
      expect(mockStore.reserveWebhook).toHaveBeenCalledWith('evt-retryable-failure', 'subscription.created');
      expect(mockStore.failWebhook).toHaveBeenCalledWith('evt-retryable-failure');
      expect(mockStore.completeWebhook).not.toHaveBeenCalled();
    });
  });

  describe('order 이벤트 처리', () => {
    beforeEach(() => {
      vi.mocked(mockStore.isWebhookProcessed).mockResolvedValue(false);
      vi.mocked(mockStore.reserveWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.completeWebhook).mockResolvedValue(undefined);
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
      expect(mockEventPublisher.publishNow).toHaveBeenCalled();
      expect(mockStore.reserveWebhook).toHaveBeenCalledWith('evt-456', 'order.paid');
      expect(mockStore.completeWebhook).toHaveBeenCalledWith('evt-456');
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

      await expect(handler.handle(body, headers)).rejects.toBeInstanceOf(WebhookValidationProblem);
      await expect(handler.handle(body, headers)).rejects.toMatchObject({
        code: 'WEBHOOK_VALIDATION_FAILED',
        detail: 'Webhook validation failed: Invalid signature',
      });
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

      await expect(handler.handle(body, headers)).rejects.toBeInstanceOf(ZodError);
    });
  });

  describe('처리 완료 후 completeWebhook 호출', () => {
    it('성공적인 이벤트 처리 후 webhook 처리 기록 저장', async () => {
      vi.mocked(mockStore.isWebhookProcessed).mockResolvedValue(false);
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
      vi.mocked(mockStore.reserveWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.completeWebhook).mockResolvedValue(undefined);

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
      expect(mockStore.reserveWebhook).toHaveBeenCalledTimes(1);
      expect(mockStore.reserveWebhook).toHaveBeenCalledWith('evt-999', 'subscription.canceled');
      expect(mockStore.completeWebhook).toHaveBeenCalledTimes(1);
      expect(mockStore.completeWebhook).toHaveBeenCalledWith('evt-999');
    });
  });
});
