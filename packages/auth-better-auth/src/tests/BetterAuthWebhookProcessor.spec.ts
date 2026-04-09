import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BetterAuthWebhookProcessor } from '../libs/BetterAuthWebhookProcessor';
import { InvalidWebhookPayloadProblem, InvalidWebhookSignatureProblem } from '../libs/problems/WebhookProblems';
import type { BetterAuthSessionProvider, BetterAuthWebhookHandler } from '../libs/types';

function createMockSessionProvider(): BetterAuthSessionProvider {
  return {
    getSession: vi.fn().mockResolvedValue(null),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    revokeUserSessions: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockWebhookRequest(
  body: unknown,
  signature: string
): { headers: Headers; json: () => Promise<unknown> } {
  return {
    headers: new Headers({
      'x-better-auth-signature': signature,
    }),
    json: () => Promise.resolve(body),
  };
}

describe('BetterAuthWebhookProcessor', () => {
  let processor!: BetterAuthWebhookProcessor;
  let mockSessionProvider!: BetterAuthSessionProvider;
  let mockHandlers!: BetterAuthWebhookHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionProvider = createMockSessionProvider();
    mockHandlers = {
      'user.created': vi.fn().mockResolvedValue(undefined),
      'user.updated': vi.fn().mockResolvedValue(undefined),
      'user.deleted': vi.fn().mockResolvedValue(undefined),
      'session.created': vi.fn().mockResolvedValue(undefined),
      'session.revoked': vi.fn().mockResolvedValue(undefined),
    };
    processor = new BetterAuthWebhookProcessor({ signingSecret: 'test-secret' }, mockHandlers, mockSessionProvider);
  });

  describe('processWebhook', () => {
    it('should throw InvalidWebhookSignatureProblem when signature is invalid', async () => {
      const request = createMockWebhookRequest({ type: 'user.created' }, 'invalid-signature');

      await expect(processor.processWebhook(request)).rejects.toBeInstanceOf(InvalidWebhookSignatureProblem);
    });

    it('should throw InvalidWebhookPayloadProblem when body is not an object', async () => {
      const request = createMockWebhookRequest('not-an-object', 'sha256=test-secret');

      await expect(processor.processWebhook(request)).rejects.toBeInstanceOf(InvalidWebhookPayloadProblem);
    });

    it('should throw InvalidWebhookPayloadProblem when type is missing', async () => {
      const request = createMockWebhookRequest({ data: {} }, 'sha256=test-secret');

      await expect(processor.processWebhook(request)).rejects.toBeInstanceOf(InvalidWebhookPayloadProblem);
    });

    it('should process user.created event', async () => {
      const eventData = { id: 'user-123', email: 'test@example.com' };
      const request = createMockWebhookRequest({ type: 'user.created', data: eventData }, 'sha256=test-secret');

      await processor.processWebhook(request);

      expect(mockHandlers['user.created']).toHaveBeenCalledWith(eventData);
    });

    it('should process user.updated event', async () => {
      const eventData = { id: 'user-123', name: 'Updated Name' };
      const request = createMockWebhookRequest({ type: 'user.updated', data: eventData }, 'sha256=test-secret');

      await processor.processWebhook(request);

      expect(mockHandlers['user.updated']).toHaveBeenCalledWith(eventData);
    });

    it('should process user.deleted event', async () => {
      const eventData = { id: 'user-123' };
      const request = createMockWebhookRequest({ type: 'user.deleted', data: eventData }, 'sha256=test-secret');

      await processor.processWebhook(request);

      expect(mockHandlers['user.deleted']).toHaveBeenCalledWith(eventData);
    });

    it('should process session.created event', async () => {
      const eventData = { id: 'session-123', userId: 'user-456' };
      const request = createMockWebhookRequest({ type: 'session.created', data: eventData }, 'sha256=test-secret');

      await processor.processWebhook(request);

      expect(mockHandlers['session.created']).toHaveBeenCalledWith(eventData);
    });

    it('should process session.revoked event', async () => {
      const eventData = { id: 'session-123', userId: 'user-456' };
      const request = createMockWebhookRequest({ type: 'session.revoked', data: eventData }, 'sha256=test-secret');

      await processor.processWebhook(request);

      expect(mockHandlers['session.revoked']).toHaveBeenCalledWith(eventData);
    });

    it('should handle unknown event types gracefully', async () => {
      const request = createMockWebhookRequest({ type: 'unknown.event', data: {} }, 'sha256=test-secret');

      await expect(processor.processWebhook(request)).resolves.not.toThrow();
    });

    it('should use empty object when data is not provided', async () => {
      const request = createMockWebhookRequest({ type: 'user.created' }, 'sha256=test-secret');

      await processor.processWebhook(request);

      expect(mockHandlers['user.created']).toHaveBeenCalledWith({});
    });

    it('should use empty object when data is not an object', async () => {
      const request = createMockWebhookRequest({ type: 'user.created', data: 'not-an-object' }, 'sha256=test-secret');

      await processor.processWebhook(request);

      expect(mockHandlers['user.created']).toHaveBeenCalledWith({});
    });

    it('should not throw when handler is not defined', async () => {
      const processorWithoutHandlers = new BetterAuthWebhookProcessor(
        { signingSecret: 'test-secret' },
        {},
        mockSessionProvider
      );
      const request = createMockWebhookRequest(
        { type: 'user.created', data: { id: 'user-123' } },
        'sha256=test-secret'
      );

      await expect(processorWithoutHandlers.processWebhook(request)).resolves.not.toThrow();
    });
  });
});
