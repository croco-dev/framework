import type { ExecutionManager } from '@croco/execution-core';
import { Container, MetadataStorage } from '@croco/framework-context';
import type { CronTriggerMetadata } from '@croco/triggers-core';
import { triggerRegistry } from '@croco/triggers-core';
import type { Receiver } from '@upstash/qstash';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QStashTriggerHandler } from '../libs/QStashTriggerHandler';

describe('QStashTriggerHandler', () => {
  beforeEach(() => {
    Container.reset();
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
    Container.set(Bug16Handler, targetInstance);

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

    const getSpy = vi.spyOn(Container, 'get');

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

  it('className 없이도 scheduleId와 methodName으로 타깃을 해석해야 한다', async () => {
    class NameFreeHandler {
      async execute(): Promise<string> {
        return 'name-free';
      }
    }

    const triggerMetadata: CronTriggerMetadata = {
      type: 'cron',
      expression: '* * * * *',
      methodName: 'execute',
      target: NameFreeHandler.prototype,
      options: {},
    };
    triggerRegistry.register(triggerMetadata);

    const targetInstance = new NameFreeHandler();
    Container.set(NameFreeHandler, targetInstance);

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn().mockResolvedValue({ id: 'exec-name-free' }),
      start: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
      retry: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
      checkpoint: vi.fn().mockResolvedValue({}),
      timeout: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    const getSpy = vi.spyOn(Container, 'get');

    const handler = new QStashTriggerHandler({
      receiver,
      executionManager,
    });

    const result = await handler.handle(
      JSON.stringify({
        scheduleId: 'croco-trigger:NameFreeHandler:execute',
        methodName: 'execute',
        cronExpression: '* * * * *',
        timestamp: new Date().toISOString(),
      }),
      'valid-signature'
    );

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(getSpy).toHaveBeenCalledWith(NameFreeHandler);
  });

  it('DI 해석 오류가 발생하면 500으로 반환해야 한다', async () => {
    class ResolverFailureHandler {
      async execute(): Promise<string> {
        return 'handled';
      }
    }

    triggerRegistry.register({
      type: 'cron',
      expression: '* * * * *',
      methodName: 'execute',
      target: ResolverFailureHandler.prototype,
      options: {},
    });

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn(),
      start: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
      cancel: vi.fn(),
      retry: vi.fn(),
      updateProgress: vi.fn(),
      checkpoint: vi.fn(),
      timeout: vi.fn(),
    } as unknown as ExecutionManager;

    const handler = new QStashTriggerHandler({
      receiver,
      executionManager,
      serviceResolver: () => {
        throw new Error('DI resolution failed');
      },
    });

    const result = await handler.handle(
      JSON.stringify({
        scheduleId: 'schedule-di-error',
        className: 'ResolverFailureHandler',
        methodName: 'execute',
        cronExpression: '* * * * *',
        timestamp: new Date().toISOString(),
      }),
      'valid-signature'
    );

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({
      error: 'Execution failed',
    });
    expect(executionManager.create).not.toHaveBeenCalled();
  });

  it('기본 serviceResolver는 DI 해석 실패를 숨기지 않고 500으로 반환해야 한다', async () => {
    class DefaultResolverFailureHandler {
      async execute(): Promise<string> {
        return 'handled';
      }
    }

    triggerRegistry.register({
      type: 'cron',
      expression: '* * * * *',
      methodName: 'execute',
      target: DefaultResolverFailureHandler.prototype,
      options: {},
    });

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn(),
      start: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
      cancel: vi.fn(),
      retry: vi.fn(),
      updateProgress: vi.fn(),
      checkpoint: vi.fn(),
      timeout: vi.fn(),
    } as unknown as ExecutionManager;

    vi.spyOn(Container, 'get').mockImplementation(() => {
      throw new Error('Container resolution failed');
    });

    const handler = new QStashTriggerHandler({
      receiver,
      executionManager,
    });

    const result = await handler.handle(
      JSON.stringify({
        scheduleId: 'schedule-default-di-error',
        className: 'DefaultResolverFailureHandler',
        methodName: 'execute',
        cronExpression: '* * * * *',
        timestamp: new Date().toISOString(),
      }),
      'valid-signature'
    );

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({
      error: 'Execution failed',
      details: 'Container resolution failed',
    });
    expect(executionManager.create).not.toHaveBeenCalled();
  });

  it('Lambda 핸들러는 소문자 서명 헤더를 지원해야 한다', async () => {
    class LowercaseHeaderHandler {
      async execute(): Promise<string> {
        return 'ok';
      }
    }

    triggerRegistry.register({
      type: 'cron',
      expression: '* * * * *',
      methodName: 'execute',
      target: LowercaseHeaderHandler.prototype,
      options: {},
    });

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn().mockResolvedValue({ id: 'exec-lower-header' }),
      start: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
      retry: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
      checkpoint: vi.fn().mockResolvedValue({}),
      timeout: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    const targetInstance = new LowercaseHeaderHandler();
    const lambdaHandler = QStashTriggerHandler.createLambdaHandler({
      receiver,
      executionManager,
      serviceResolver: () => targetInstance,
    });

    const response = await lambdaHandler({
      body: JSON.stringify({
        scheduleId: 'schedule-lower-header',
        className: 'LowercaseHeaderHandler',
        methodName: 'execute',
        cronExpression: '* * * * *',
        timestamp: new Date().toISOString(),
      }),
      headers: {
        'upstash-signature': 'valid-signature',
      },
    });

    expect(response.statusCode).toBe(200);

    const parsed = JSON.parse(response.body) as {
      executionId: string;
      result: string;
    };

    expect(parsed.executionId).toBe('exec-lower-header');
    expect(parsed.result).toBe('ok');
    expect(receiver.verify).toHaveBeenCalled();
  });
});
