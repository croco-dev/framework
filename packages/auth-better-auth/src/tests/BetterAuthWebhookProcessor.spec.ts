import { createHmac } from 'node:crypto';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BetterAuthWebhookProcessor } from '../libs/BetterAuthWebhookProcessor';
import { InvalidWebhookPayloadProblem, InvalidWebhookSignatureProblem } from '../libs/problems/WebhookProblems';
import type { BetterAuthSessionProvider, BetterAuthWebhookHandler } from '../libs/types';

const TEST_SIGNING_SECRET = 'test-secret';

function createMockSessionProvider(): BetterAuthSessionProvider {
  return {
    getSession: vi.fn().mockResolvedValue(null),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    revokeUserSessions: vi.fn().mockResolvedValue(undefined),
  };
}

function createSignature(body: string, secret = TEST_SIGNING_SECRET): string {
  const digest = createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${digest}`;
}

function createMockWebhookRequest(body: string, signature?: string): { headers: Headers; text: () => Promise<string> } {
  return {
    headers: new Headers(signature ? { 'x-better-auth-signature': signature } : {}),
    text: () => Promise.resolve(body),
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
    processor = new BetterAuthWebhookProcessor(
      { signingSecret: TEST_SIGNING_SECRET },
      mockHandlers,
      mockSessionProvider
    );
  });

  describe('processWebhook', () => {
    it('should process user.created event with a valid HMAC signature', async () => {
      const eventData = { id: 'user-123', email: 'test@example.com' };
      const rawBody = JSON.stringify({ type: 'user.created', data: eventData });
      const request = createMockWebhookRequest(rawBody, createSignature(rawBody));

      await processor.processWebhook(request);

      expect(mockHandlers['user.created']).toHaveBeenCalledWith(eventData);
    });

    it('should throw InvalidWebhookSignatureProblem when signature is invalid', async () => {
      const rawBody = JSON.stringify({ type: 'user.created' });
      const request = createMockWebhookRequest(rawBody, 'invalid-signature');

      await expect(processor.processWebhook(request)).rejects.toBeInstanceOf(InvalidWebhookSignatureProblem);
    });

    it('should throw InvalidWebhookSignatureProblem when signature header is missing', async () => {
      const rawBody = JSON.stringify({ type: 'user.created' });
      const request = createMockWebhookRequest(rawBody);

      await expect(processor.processWebhook(request)).rejects.toBeInstanceOf(InvalidWebhookSignatureProblem);
    });

    it('should accept an empty body when its HMAC is valid and then fail payload parsing', async () => {
      const rawBody = '';
      const request = createMockWebhookRequest(rawBody, createSignature(rawBody));

      await expect(processor.processWebhook(request)).rejects.toBeInstanceOf(InvalidWebhookPayloadProblem);
    });

    it('should throw InvalidWebhookSignatureProblem when the body is tampered with', async () => {
      const signedBody = JSON.stringify({ type: 'user.created', data: { id: 'user-123' } });
      const tamperedBody = JSON.stringify({ type: 'user.created', data: { id: 'user-456' } });
      const request = createMockWebhookRequest(tamperedBody, createSignature(signedBody));

      await expect(processor.processWebhook(request)).rejects.toBeInstanceOf(InvalidWebhookSignatureProblem);
    });

    it('should throw InvalidWebhookPayloadProblem when body is not an object', async () => {
      const rawBody = JSON.stringify('not-an-object');
      const request = createMockWebhookRequest(rawBody, createSignature(rawBody));

      await expect(processor.processWebhook(request)).rejects.toBeInstanceOf(InvalidWebhookPayloadProblem);
    });

    it('should throw InvalidWebhookPayloadProblem when type is missing', async () => {
      const rawBody = JSON.stringify({ data: {} });
      const request = createMockWebhookRequest(rawBody, createSignature(rawBody));

      await expect(processor.processWebhook(request)).rejects.toBeInstanceOf(InvalidWebhookPayloadProblem);
    });

    it('should process user.updated event', async () => {
      const eventData = { id: 'user-123', name: 'Updated Name' };
      const rawBody = JSON.stringify({ type: 'user.updated', data: eventData });
      const request = createMockWebhookRequest(rawBody, createSignature(rawBody));

      await processor.processWebhook(request);

      expect(mockHandlers['user.updated']).toHaveBeenCalledWith(eventData);
    });

    it('should process user.deleted event', async () => {
      const eventData = { id: 'user-123' };
      const rawBody = JSON.stringify({ type: 'user.deleted', data: eventData });
      const request = createMockWebhookRequest(rawBody, createSignature(rawBody));

      await processor.processWebhook(request);

      expect(mockHandlers['user.deleted']).toHaveBeenCalledWith(eventData);
    });

    it('should process session.created event', async () => {
      const eventData = { id: 'session-123', userId: 'user-456' };
      const rawBody = JSON.stringify({ type: 'session.created', data: eventData });
      const request = createMockWebhookRequest(rawBody, createSignature(rawBody));

      await processor.processWebhook(request);

      expect(mockHandlers['session.created']).toHaveBeenCalledWith(eventData);
    });

    it('should process session.revoked event', async () => {
      const eventData = { id: 'session-123', userId: 'user-456' };
      const rawBody = JSON.stringify({ type: 'session.revoked', data: eventData });
      const request = createMockWebhookRequest(rawBody, createSignature(rawBody));

      await processor.processWebhook(request);

      expect(mockHandlers['session.revoked']).toHaveBeenCalledWith(eventData);
    });

    it('should handle unknown event types gracefully', async () => {
      const rawBody = JSON.stringify({ type: 'unknown.event', data: {} });
      const request = createMockWebhookRequest(rawBody, createSignature(rawBody));

      await expect(processor.processWebhook(request)).resolves.not.toThrow();
    });

    it('should use empty object when data is not provided', async () => {
      const rawBody = JSON.stringify({ type: 'user.created' });
      const request = createMockWebhookRequest(rawBody, createSignature(rawBody));

      await processor.processWebhook(request);

      expect(mockHandlers['user.created']).toHaveBeenCalledWith({});
    });

    it('should use empty object when data is not an object', async () => {
      const rawBody = JSON.stringify({ type: 'user.created', data: 'not-an-object' });
      const request = createMockWebhookRequest(rawBody, createSignature(rawBody));

      await processor.processWebhook(request);

      expect(mockHandlers['user.created']).toHaveBeenCalledWith({});
    });

    it('should not throw when handler is not defined', async () => {
      const processorWithoutHandlers = new BetterAuthWebhookProcessor(
        { signingSecret: TEST_SIGNING_SECRET },
        {},
        mockSessionProvider
      );
      const rawBody = JSON.stringify({ type: 'user.created', data: { id: 'user-123' } });
      const request = createMockWebhookRequest(rawBody, createSignature(rawBody));

      await expect(processorWithoutHandlers.processWebhook(request)).resolves.not.toThrow();
    });
  });
});
