import { MetadataStorage } from '@croco/framework-context';
import type { CronTriggerMetadata } from '@croco/triggers-core';
import { triggerRegistry } from '@croco/triggers-core';
import type { Client } from '@upstash/qstash';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QStashScheduler } from '../libs/QStashScheduler';

describe('QStashScheduler', () => {
  beforeEach(() => {
    MetadataStorage.clear();
    vi.restoreAllMocks();
  });

  it('목록 조회 실패 시 동기화를 중단하고 create/delete를 호출하지 않아야 한다', async () => {
    class ListFailureJob {
      async run(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: 'cron',
      expression: '* * * * *',
      methodName: 'run',
      target: ListFailureJob.prototype,
      options: {},
    };
    triggerRegistry.register(metadata);

    const list = vi.fn().mockRejectedValue(new Error('list failed'));
    const create = vi.fn();
    const deleteSchedule = vi.fn();

    const client = {
      schedules: {
        list,
        create,
        delete: deleteSchedule,
      },
    } as unknown as Client;

    const scheduler = new QStashScheduler({
      client,
      webhookUrl: 'https://api.example.com/webhooks/qstash',
    });

    await expect(scheduler.sync()).rejects.toThrow('list failed');
    expect(create).not.toHaveBeenCalled();
    expect(deleteSchedule).not.toHaveBeenCalled();
  });

  it('목록 조회 성공 시 신규 스케줄을 생성해야 한다', async () => {
    class NewScheduleJob {
      async processQueue(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: 'cron',
      expression: '*/5 * * * *',
      methodName: 'processQueue',
      target: NewScheduleJob.prototype,
      options: {},
    };
    triggerRegistry.register(metadata);

    const list = vi.fn().mockResolvedValue([]);
    const create = vi.fn().mockResolvedValue({});
    const deleteSchedule = vi.fn();

    const client = {
      schedules: {
        list,
        create,
        delete: deleteSchedule,
      },
    } as unknown as Client;

    const scheduler = new QStashScheduler({
      client,
      webhookUrl: 'https://api.example.com/webhooks/qstash',
    });

    const result = await scheduler.sync();

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        cron: '*/5 * * * *',
        destination: 'https://api.example.com/webhooks/qstash',
        method: 'POST',
        body: expect.any(String),
        headers: expect.objectContaining({
          'X-Schedule-Id': 'croco-trigger:processQueue:processQueue',
        }),
      })
    );

    const payload = JSON.parse(create.mock.calls[0]?.[0]?.body as string) as {
      scheduleId: string;
      triggerName?: string;
      methodName: string;
    };

    expect(payload).toMatchObject({
      scheduleId: 'croco-trigger:processQueue:processQueue',
      triggerName: 'processQueue',
      methodName: 'processQueue',
    });
    expect(deleteSchedule).not.toHaveBeenCalled();
  });

  it('명시적 cron name을 schedule 식별자로 사용해야 한다', async () => {
    class NamedScheduleJob {
      async processQueue(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: 'cron',
      expression: '*/10 * * * *',
      methodName: 'processQueue',
      target: NamedScheduleJob.prototype,
      options: {
        name: 'queue-drain',
      },
    };
    triggerRegistry.register(metadata);

    const create = vi.fn().mockResolvedValue({});
    const client = {
      schedules: {
        list: vi.fn().mockResolvedValue([]),
        create,
        delete: vi.fn(),
      },
    } as unknown as Client;

    const scheduler = new QStashScheduler({
      client,
      webhookUrl: 'https://api.example.com/webhooks/qstash',
    });

    await scheduler.sync();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Schedule-Id': 'croco-trigger:queue-drain:processQueue',
        }),
      })
    );

    const payload = JSON.parse(create.mock.calls[0]?.[0]?.body as string) as {
      scheduleId: string;
      triggerName?: string;
      className?: string;
    };

    expect(payload).toMatchObject({
      scheduleId: 'croco-trigger:queue-drain:processQueue',
      triggerName: 'queue-drain',
      className: 'NamedScheduleJob',
    });
  });

  it('스케줄 생성 실패를 failed로 집계해야 한다', async () => {
    class FailingScheduleJob {
      async processQueue(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: 'cron',
      expression: '*/5 * * * *',
      methodName: 'processQueue',
      target: FailingScheduleJob.prototype,
      options: {},
    };
    triggerRegistry.register(metadata);

    const create = vi.fn().mockRejectedValue(new Error('create failed'));
    const client = {
      schedules: {
        list: vi.fn().mockResolvedValue([]),
        create,
        delete: vi.fn(),
      },
    } as unknown as Client;

    const scheduler = new QStashScheduler({
      client,
      webhookUrl: 'https://api.example.com/webhooks/qstash',
    });

    const result = await scheduler.sync();

    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.details).toEqual([
      expect.objectContaining({
        name: 'croco-trigger:processQueue:processQueue',
        action: 'failed',
        error: 'create failed',
      }),
    ]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('삭제 실패를 deleted가 아니라 failed로 집계해야 한다', async () => {
    const client = {
      schedules: {
        list: vi.fn().mockResolvedValue([
          {
            scheduleId: 'croco-trigger:orphan:run',
            cron: '* * * * *',
          },
        ]),
        create: vi.fn(),
        delete: vi.fn().mockRejectedValue(new Error('delete failed')),
      },
    } as unknown as Client;

    const scheduler = new QStashScheduler({
      client,
      webhookUrl: 'https://api.example.com/webhooks/qstash',
    });

    const result = await scheduler.sync();

    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.details).toEqual([
      expect.objectContaining({
        name: 'croco-trigger:orphan:run',
        action: 'failed',
        error: 'delete failed',
      }),
    ]);
  });

  it('cron 변경 시 delete 없이 같은 scheduleId로 갱신해야 한다', async () => {
    class UpdatedScheduleJob {
      async processQueue(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: 'cron',
      expression: '*/10 * * * *',
      methodName: 'processQueue',
      target: UpdatedScheduleJob.prototype,
      options: {},
    };
    triggerRegistry.register(metadata);

    const create = vi.fn().mockResolvedValue({});
    const deleteSchedule = vi.fn();
    const client = {
      schedules: {
        list: vi.fn().mockResolvedValue([
          {
            scheduleId: 'croco-trigger:processQueue:processQueue',
            cron: '*/5 * * * *',
          },
        ]),
        create,
        delete: deleteSchedule,
      },
    } as unknown as Client;

    const scheduler = new QStashScheduler({
      client,
      webhookUrl: 'https://api.example.com/webhooks/qstash',
    });

    const result = await scheduler.sync();

    expect(result.updated).toBe(1);
    expect(result.failed).toBe(0);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: 'croco-trigger:processQueue:processQueue',
        cron: '*/10 * * * *',
      })
    );
    expect(deleteSchedule).not.toHaveBeenCalled();
  });

  it('cron 변경 갱신 실패 시 기존 스케줄 삭제를 시도하지 않아야 한다', async () => {
    class FailingUpdateScheduleJob {
      async processQueue(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: 'cron',
      expression: '*/10 * * * *',
      methodName: 'processQueue',
      target: FailingUpdateScheduleJob.prototype,
      options: {},
    };
    triggerRegistry.register(metadata);

    const create = vi.fn().mockRejectedValue(new Error('update failed'));
    const deleteSchedule = vi.fn();
    const client = {
      schedules: {
        list: vi.fn().mockResolvedValue([
          {
            scheduleId: 'croco-trigger:processQueue:processQueue',
            cron: '*/5 * * * *',
          },
        ]),
        create,
        delete: deleteSchedule,
      },
    } as unknown as Client;

    const scheduler = new QStashScheduler({
      client,
      webhookUrl: 'https://api.example.com/webhooks/qstash',
    });

    const result = await scheduler.sync();

    expect(result.updated).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.details).toEqual([
      expect.objectContaining({
        name: 'croco-trigger:processQueue:processQueue',
        action: 'failed',
        error: 'update failed',
      }),
    ]);
    expect(deleteSchedule).not.toHaveBeenCalled();
  });
});
