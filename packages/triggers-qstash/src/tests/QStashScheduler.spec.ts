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
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        cron: '*/5 * * * *',
        destination: 'https://api.example.com/webhooks/qstash',
        method: 'POST',
      })
    );
    expect(deleteSchedule).not.toHaveBeenCalled();
  });
});
