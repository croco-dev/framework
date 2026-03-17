import { Container } from '@croco/framework-context';
import type { NotificationPayload } from '@croco/notifications-core';
import { NotificationChannel } from '@croco/notifications-core';
import type { CreateEmailResponse } from 'resend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResendNotificationProblem } from '../libs/problems/ResendNotificationProblem';
import { ResendProvider } from '../libs/ResendProvider';

type MockResendClient = InstanceType<typeof import('resend')['Resend']>;

// Mock resend package
vi.mock('resend', () => {
  const emailsSendMock = vi.fn();
  class MockResend {
    emails = {
      send: emailsSendMock,
    };
  }
  return { Resend: MockResend };
});

describe('ResendProvider', () => {
  let provider!: ResendProvider;
  let mockResendClient!: MockResendClient;

  const mockConfig = {
    apiKey: 're_test-key',
    from: 'noreply@example.com',
  };

  beforeEach(async () => {
    Container.reset();
    vi.clearAllMocks();

    provider = new ResendProvider(mockConfig);

    // Get mock instance
    const { Resend } = await import('resend');
    mockResendClient = new Resend();
  });

  describe('getName()', () => {
    it('should return resend as provider name', () => {
      expect(provider.getName()).toBe('resend');
    });
  });

  describe('getChannel()', () => {
    it('should return EMAIL channel', () => {
      expect(provider.getChannel()).toBe(NotificationChannel.EMAIL);
    });
  });

  describe('send()', () => {
    const mockSuccessResponse: CreateEmailResponse = {
      data: { id: 'msg-123' },
      error: null,
    };

    const mockErrorResponse: CreateEmailResponse = {
      data: null,
      error: { message: 'Invalid API key', name: 'invalid_api_Key' },
    };

    it('should send email successfully with subject', async () => {
      vi.mocked(mockResendClient.emails.send).mockResolvedValue(mockSuccessResponse);

      const payload: NotificationPayload = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        content: '<h1>Test Content</h1>',
      };

      const result = await provider.send(payload);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        {
          from: 'noreply@example.com',
          to: 'recipient@example.com',
          subject: 'Test Subject',
          html: '<h1>Test Content</h1>',
        },
        {
          idempotencyKey: expect.stringMatching(/^resend-/),
        }
      );
    });

    it('should send email without subject using default', async () => {
      vi.mocked(mockResendClient.emails.send).mockResolvedValue(mockSuccessResponse);

      const payload: NotificationPayload = {
        to: 'recipient@example.com',
        content: '<h1>Test Content</h1>',
      };

      await provider.send(payload);

      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        {
          from: 'noreply@example.com',
          to: 'recipient@example.com',
          subject: 'No Subject',
          html: '<h1>Test Content</h1>',
        },
        {
          idempotencyKey: expect.stringMatching(/^resend-/),
        }
      );
    });

    it('should send email with templateId', async () => {
      vi.mocked(mockResendClient.emails.send).mockResolvedValue(mockSuccessResponse);

      const payload: NotificationPayload = {
        to: 'recipient@example.com',
        subject: 'Welcome',
        content: '<h1>Welcome</h1>',
        templateId: 'welcome-template',
      };

      await provider.send(payload);

      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        {
          from: 'noreply@example.com',
          to: 'recipient@example.com',
          subject: 'Welcome',
          html: '<h1>Welcome</h1>',
        },
        {
          idempotencyKey: expect.stringMatching(/^resend-/),
        }
      );
    });

    it('should return error result when API returns error', async () => {
      vi.mocked(mockResendClient.emails.send).mockResolvedValue(mockErrorResponse);

      const payload: NotificationPayload = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        content: '<h1>Test Content</h1>',
      };

      const result = await provider.send(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ResendNotificationProblem);
      expect(result.error?.message).toBe('Invalid API key');
      expect(result.providerResponse).toEqual(mockErrorResponse);
      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(1);
    });

    it('should retry transient API error responses with the same idempotency key', async () => {
      const transientErrorResponse: CreateEmailResponse = {
        data: null,
        error: { message: 'Rate limit exceeded', name: 'rate_limit_exceeded' },
      };

      vi.mocked(mockResendClient.emails.send)
        .mockResolvedValueOnce(transientErrorResponse)
        .mockResolvedValueOnce(mockSuccessResponse);

      const payload: NotificationPayload = {
        to: 'recipient@example.com',
        subject: 'Retry Subject',
        content: '<h1>Retry Content</h1>',
      };

      const result = await provider.send(payload);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(2);

      const firstCallOptions = vi.mocked(mockResendClient.emails.send).mock.calls[0]?.[1];
      const secondCallOptions = vi.mocked(mockResendClient.emails.send).mock.calls[1]?.[1];

      expect(firstCallOptions?.idempotencyKey).toMatch(/^resend-/);
      expect(secondCallOptions?.idempotencyKey).toBe(firstCallOptions?.idempotencyKey);
    });

    it('should retry transient thrown errors before succeeding', async () => {
      const networkError = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });

      vi.mocked(mockResendClient.emails.send)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockSuccessResponse);

      const payload: NotificationPayload = {
        to: 'recipient@example.com',
        subject: 'Retry Subject',
        content: '<h1>Retry Content</h1>',
      };

      const result = await provider.send(payload);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(2);
    });

    it('should not retry invalid idempotent request errors', async () => {
      const invalidIdempotentRequestResponse: CreateEmailResponse = {
        data: null,
        error: { message: 'Invalid idempotency key reuse', name: 'invalid_idempotent_request' },
      };

      vi.mocked(mockResendClient.emails.send).mockResolvedValueOnce(invalidIdempotentRequestResponse);

      const payload: NotificationPayload = {
        to: 'recipient@example.com',
        subject: 'Retry Subject',
        content: '<h1>Retry Content</h1>',
      };

      const result = await provider.send(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ResendNotificationProblem);
      expect(result.error?.message).toBe('Invalid idempotency key reuse');
      expect(result.providerResponse).toEqual(invalidIdempotentRequestResponse);
      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(1);
    });

    it('should handle network error', async () => {
      const networkError = new Error('Network connection failed');
      vi.mocked(mockResendClient.emails.send).mockRejectedValue(networkError);

      const payload: NotificationPayload = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        content: '<h1>Test Content</h1>',
      };

      const result = await provider.send(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ResendNotificationProblem);
      expect(result.error?.message).toBe('Network connection failed');

      if (!(result.error instanceof ResendNotificationProblem)) {
        throw new Error('Expected ResendNotificationProblem');
      }

      expect(result.error.cause).toBe(networkError);
    });

    it('should include providerResponse in success result', async () => {
      vi.mocked(mockResendClient.emails.send).mockResolvedValue(mockSuccessResponse);

      const payload: NotificationPayload = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        content: '<h1>Test Content</h1>',
      };

      const result = await provider.send(payload);

      expect(result.success).toBe(true);
      expect(result.providerResponse).toEqual(mockSuccessResponse);
    });

    it('should handle metadata and variables in payload', async () => {
      vi.mocked(mockResendClient.emails.send).mockResolvedValue(mockSuccessResponse);

      const payload: NotificationPayload = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        content: '<h1>Test Content</h1>',
        metadata: { userId: '123' },
        variables: { name: 'John' },
      };

      await provider.send(payload);

      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        {
          from: 'noreply@example.com',
          to: 'recipient@example.com',
          subject: 'Test Subject',
          html: '<h1>Test Content</h1>',
        },
        {
          idempotencyKey: expect.stringMatching(/^resend-/),
        }
      );
    });
  });
});
