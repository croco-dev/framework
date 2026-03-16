import type { ExecutionManager } from '@croco/execution-core';
import { Container } from '@croco/framework-context';
import { TaskRegistry, TaskRunner } from '@croco/tasks-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProviderRegistry } from '../libs/NotificationProviderRegistry';
import { NotificationService } from '../libs/NotificationService';
import {
  NotificationProviderChannelMismatchProblem,
  NotificationProviderNotConfiguredProblem,
  NotificationProviderNotRegisteredProblem,
} from '../libs/problems/NotificationProblems';
import { NotificationChannel } from '../libs/types';
import { createProvider, type MockNotificationProvider } from './__fixtures__/mockProvider';

const createExecutionManager = (): ExecutionManager => ({
  create: vi.fn(async () => {
    throw new Error('not used in NotificationService tests');
  }),
  start: vi.fn(async () => {
    throw new Error('not used in NotificationService tests');
  }),
  complete: vi.fn(async () => {
    throw new Error('not used in NotificationService tests');
  }),
  fail: vi.fn(async () => {
    throw new Error('not used in NotificationService tests');
  }),
  cancel: vi.fn(async () => {
    throw new Error('not used in NotificationService tests');
  }),
  retry: vi.fn(async () => {
    throw new Error('not used in NotificationService tests');
  }),
  updateProgress: vi.fn(async () => {
    throw new Error('not used in NotificationService tests');
  }),
  checkpoint: vi.fn(async () => {
    throw new Error('not used in NotificationService tests');
  }),
  timeout: vi.fn(async () => {
    throw new Error('not used in NotificationService tests');
  }),
});

describe('NotificationService', () => {
  let service!: NotificationService;
  let registry!: NotificationProviderRegistry;
  let taskRunner!: TaskRunner;
  let executeSpy!: ReturnType<typeof vi.fn>;
  let emailProvider!: MockNotificationProvider;

  beforeEach(() => {
    Container.reset();
    vi.clearAllMocks();

    registry = new NotificationProviderRegistry();
    taskRunner = new TaskRunner(createExecutionManager(), new TaskRegistry());
    executeSpy = vi.spyOn(taskRunner, 'execute').mockResolvedValue(undefined);
    service = new NotificationService(taskRunner, registry);
    emailProvider = createProvider('email-provider', NotificationChannel.EMAIL);
  });

  describe('registerProvider()', () => {
    it('should register provider successfully', () => {
      service.registerProvider(emailProvider);

      expect(emailProvider.getName).toHaveBeenCalledTimes(1);
      expect(emailProvider.getChannel).not.toHaveBeenCalled();
    });

    it('should register provider as default when isDefault is true', () => {
      service.registerProvider(emailProvider, true);

      expect(emailProvider.getName).toHaveBeenCalledTimes(1);
      expect(emailProvider.getChannel).toHaveBeenCalledTimes(1);
    });
  });

  describe('send()', () => {
    it('should send notification via task execution with default provider', async () => {
      service.registerProvider(emailProvider, true);

      const payload = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test Content',
      };

      await service.send(NotificationChannel.EMAIL, payload);

      expect(executeSpy).toHaveBeenCalledWith('send-notification', {
        ...payload,
        providerName: 'email-provider',
      });
    });

    it('should use specified provider name when it matches the requested channel', async () => {
      const smsProvider = createProvider('sms-provider', NotificationChannel.SMS);

      service.registerProvider(emailProvider, true);
      service.registerProvider(smsProvider);

      const payload = {
        to: 'test@example.com',
        content: 'Test Content',
      };

      await service.send(NotificationChannel.SMS, payload, 'sms-provider');

      expect(executeSpy).toHaveBeenCalledWith('send-notification', {
        ...payload,
        providerName: 'sms-provider',
      });
    });

    it('should include metadata in job payload', async () => {
      service.registerProvider(emailProvider, true);

      const payload = {
        to: 'test@example.com',
        subject: 'Test Subject',
        content: 'Test Content',
        metadata: { userId: '123', category: 'promo' },
      };

      await service.send(NotificationChannel.EMAIL, payload);

      expect(executeSpy).toHaveBeenCalledWith('send-notification', {
        ...payload,
        providerName: 'email-provider',
      });
    });

    it('should include templateId and variables in job payload', async () => {
      service.registerProvider(emailProvider, true);

      const payload = {
        to: 'test@example.com',
        content: 'Test Content',
        templateId: 'welcome-email',
        variables: { name: 'John' },
      };

      await service.send(NotificationChannel.EMAIL, payload);

      expect(executeSpy).toHaveBeenCalledWith('send-notification', {
        ...payload,
        providerName: 'email-provider',
      });
    });

    it('should throw error when no default provider found for channel', async () => {
      const payload = {
        to: 'test@example.com',
        content: 'Test Content',
      };

      await expect(service.send(NotificationChannel.EMAIL, payload)).rejects.toBeInstanceOf(
        NotificationProviderNotConfiguredProblem
      );
    });

    it('should throw error when specified provider is not registered', async () => {
      service.registerProvider(emailProvider, true);

      const payload = {
        to: 'test@example.com',
        content: 'Test Content',
      };

      await expect(service.send(NotificationChannel.EMAIL, payload, 'non-existent')).rejects.toBeInstanceOf(
        NotificationProviderNotRegisteredProblem
      );
    });

    it('should throw error when specified provider channel does not match requested channel', async () => {
      const smsProvider = createProvider('sms-provider', NotificationChannel.SMS);

      service.registerProvider(emailProvider, true);
      service.registerProvider(smsProvider);

      const payload = {
        to: 'test@example.com',
        content: 'Test Content',
      };

      await expect(service.send(NotificationChannel.EMAIL, payload, 'sms-provider')).rejects.toBeInstanceOf(
        NotificationProviderChannelMismatchProblem
      );
      expect(executeSpy).not.toHaveBeenCalled();
    });
  });
});
