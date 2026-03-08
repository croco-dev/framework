import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProviderRegistry } from '../libs/NotificationProviderRegistry';
import { NotificationService } from '../libs/NotificationService';
import {
  NotificationProviderNotConfiguredProblem,
  NotificationProviderNotRegisteredProblem,
} from '../libs/problems/NotificationProblems';
import { NotificationChannel } from '../libs/types';

// Mock TaskRunner
const mockTaskRunner = {
  execute: vi.fn().mockResolvedValue(undefined),
};

describe('NotificationService', () => {
  let service!: NotificationService;
  let registry!: NotificationProviderRegistry;
  let mockProvider!: {
    getName: ReturnType<typeof vi.fn>;
    getChannel: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    Container.reset();
    vi.clearAllMocks();

    registry = new NotificationProviderRegistry();
    service = new NotificationService(mockTaskRunner as never, registry);

    mockProvider = {
      getName: vi.fn().mockReturnValue('test-provider'),
      getChannel: vi.fn().mockReturnValue(NotificationChannel.EMAIL),
      send: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-123' }),
    };
  });

  describe('registerProvider()', () => {
    it('should register provider successfully', () => {
      service.registerProvider(mockProvider as never);

      expect(mockProvider.getName).toHaveBeenCalled();
    });

    it('should register provider as default when isDefault is true', () => {
      service.registerProvider(mockProvider as never, true);

      expect(mockProvider.getChannel).toHaveBeenCalled();
    });

    it('should not set default when isDefault is false', () => {
      service.registerProvider(mockProvider as never, false);

      // Should not throw when sending without providerName but no default
      expect(mockProvider.getChannel).not.toHaveBeenCalled();
    });
  });

  describe('send()', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider as never, true);
    });

    it('should send notification via task execution with default provider', async () => {
      const payload = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test Content',
      };

      await service.send(NotificationChannel.EMAIL, payload);

      expect(mockTaskRunner.execute).toHaveBeenCalledWith('send-notification', {
        ...payload,
        providerName: 'test-provider',
      });
    });

    it('should send notification with specified provider name', async () => {
      service.registerProvider(mockProvider as never, false);

      const payload = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test Content',
      };

      await service.send(NotificationChannel.EMAIL, payload, 'test-provider');

      expect(mockTaskRunner.execute).toHaveBeenCalledWith('send-notification', {
        ...payload,
        providerName: 'test-provider',
      });
    });
    it('should send notification with specified provider name', async () => {
      service.registerProvider(mockProvider as never, false);

      const payload = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test Content',
      };

      await service.send(NotificationChannel.EMAIL, payload, 'test-provider');

      expect(mockTaskRunner.execute).toHaveBeenCalledWith('send-notification', {
        ...payload,
        providerName: 'test-provider',
      });
    });

    it('should throw error when specified provider is not registered', async () => {
      service.registerProvider(mockProvider as never, false);

      const payload = {
        to: 'test@example.com',
        content: 'Test Content',
      };

      await expect(service.send(NotificationChannel.EMAIL, payload, 'non-existent')).rejects.toBeInstanceOf(
        NotificationProviderNotRegisteredProblem
      );
    });
  });

  describe('send() - error cases', () => {
    it('should throw error when no default provider found for channel', async () => {
      const smsProvider = {
        getName: vi.fn().mockReturnValue('sms-provider'),
        getChannel: vi.fn().mockReturnValue(NotificationChannel.SMS),
        send: vi.fn().mockResolvedValue({ success: true }),
      };

      service.registerProvider(smsProvider as never, true);

      const payload = {
        to: 'test@example.com',
        content: 'Test Content',
      };

      await expect(service.send(NotificationChannel.EMAIL, payload)).rejects.toBeInstanceOf(
        NotificationProviderNotConfiguredProblem
      );
    });
  });

  describe('send()', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider as never, true);
    });

    it('should send notification via task execution with default provider', async () => {
      const payload = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test Content',
      };

      await service.send(NotificationChannel.EMAIL, payload);

      expect(mockTaskRunner.execute).toHaveBeenCalledWith('send-notification', {
        ...payload,
        providerName: 'test-provider',
      });
    });

    it('should send notification with specified provider name', async () => {
      service.registerProvider(mockProvider as never, false);

      const payload = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test Content',
      };

      await service.send(NotificationChannel.EMAIL, payload, 'test-provider');

      expect(mockTaskRunner.execute).toHaveBeenCalledWith('send-notification', {
        ...payload,
        providerName: 'test-provider',
      });
    });

    it('should throw error when specified provider is not registered', async () => {
      service.registerProvider(mockProvider as never, false);

      const payload = {
        to: 'test@example.com',
        content: 'Test Content',
      };

      await expect(service.send(NotificationChannel.EMAIL, payload, 'non-existent')).rejects.toThrow(
        'Provider non-existent is not registered'
      );
    });

    it('should include metadata in job payload', async () => {
      const payload = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test Content',
        metadata: { userId: '123', category: 'promo' },
      };

      await service.send(NotificationChannel.EMAIL, payload);

      expect(mockTaskRunner.execute).toHaveBeenCalledWith('send-notification', {
        ...payload,
        providerName: 'test-provider',
      });
    });

    it('should include templateId and variables in job payload', async () => {
      const payload = {
        to: 'test@example.com',
        content: 'Test Content',
        templateId: 'welcome-email',
        variables: { name: 'John' },
      };

      await service.send(NotificationChannel.EMAIL, payload);

      expect(mockTaskRunner.execute).toHaveBeenCalledWith('send-notification', {
        ...payload,
        providerName: 'test-provider',
      });
    });
  });
});
