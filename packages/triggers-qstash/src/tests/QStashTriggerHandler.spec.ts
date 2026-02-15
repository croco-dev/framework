import type { ExecutionManager } from '@croco/execution-core';
import { MetadataStorage } from '@croco/framework-context';
import type { CronTriggerMetadata } from '@croco/triggers-core';
import { triggerRegistry } from '@croco/triggers-core';
import type { Receiver } from '@upstash/qstash';
import { Container as TypeDIContainer } from 'typedi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QStashTriggerHandler } from '../libs/QStashTriggerHandler';

describe('QStashTriggerHandler', () => {
  beforeEach(() => {
    TypeDIContainer.reset();
    MetadataStorage.clear();
    vi.restoreAllMocks();
  });

  it('BUG-16 핸들러 클래스가 DI로 올바르게 해결되어야 한다', async () => {
    class Bug16Handler {
      async execute(): Promise<string> {
        return 'handled';
      }
    }

    const triggerMetadata: CronTriggerMetadata = {
      type: 'cron',
      expression: '* * * * *',
      methodName: 'execute',
      target: Bug16Handler.prototype,
      options: {},
    };
    triggerRegistry.register(triggerMetadata);

    const targetInstance = new Bug16Handler();
    TypeDIContainer.set({ id: Bug16Handler, value: targetInstance });

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn().mockResolvedValue({ id: 'exec-bug-16' }),
      start: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
      retry: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
      checkpoint: vi.fn().mockResolvedValue({}),
      timeout: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    const getSpy = vi.spyOn(TypeDIContainer, 'get');

    const handler = new QStashTriggerHandler({
      receiver,
      executionManager,
    });

    const result = await handler.handle(
      JSON.stringify({
        scheduleId: 'schedule-bug-16',
        className: 'Bug16Handler',
        methodName: 'execute',
        cronExpression: '* * * * *',
        timestamp: new Date().toISOString(),
      }),
      'valid-signature'
    );

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(getSpy).toHaveBeenCalledWith(Bug16Handler);
    expect(getSpy).not.toHaveBeenCalledWith('Bug16Handler');
  });
});
