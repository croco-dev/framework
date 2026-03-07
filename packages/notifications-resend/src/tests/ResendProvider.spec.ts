import { Container } from '@croco/framework-context';
import type { NotificationPayload } from '@croco/notifications-core';
import { NotificationChannel } from '@croco/notifications-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResendNotificationProblem } from '../libs/problems/ResendNotificationProblem';
import { ResendProvider } from '../libs/ResendProvider';

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
  let mockResendClient!: any;

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
    const mockSuccessResponse = {
      data: { id: 'msg-123' },
      error: null,
    };

    const mockErrorResponse = {
      data: null,
      error: { message: 'Invalid API key' },
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
      expect(mockResendClient.emails.send).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<h1>Test Content</h1>',
      });
    });

    it('should send email without subject using default', async () => {
      vi.mocked(mockResendClient.emails.send).mockResolvedValue(mockSuccessResponse);

      const payload: NotificationPayload = {
        to: 'recipient@example.com',
        content: '<h1>Test Content</h1>',
      };

      await provider.send(payload);

      expect(mockResendClient.emails.send).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'recipient@example.com',
        subject: 'No Subject',
        html: '<h1>Test Content</h1>',
      });
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

      expect(mockResendClient.emails.send).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'recipient@example.com',
        subject: 'Welcome',
        html: '<h1>Welcome</h1>',
      });
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

      expect(mockResendClient.emails.send).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<h1>Test Content</h1>',
      });
    });
  });
});
