import { MetadataStorage } from "@croco/framework-context";
import type { CronTriggerMetadata } from "@croco/triggers-core";
import { triggerRegistry } from "@croco/triggers-core";
import type { Client } from "@upstash/qstash";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QStashScheduler } from "../libs/QStashScheduler";

describe("QStashScheduler", () => {
  beforeEach(() => {
    MetadataStorage.clear();
    vi.restoreAllMocks();
  });

  it("목록 조회 실패 시 동기화를 중단하고 create/delete를 호출하지 않아야 한다", async () => {
    class ListFailureJob {
      async run(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: "cron",
      expression: "* * * * *",
      methodName: "run",
      target: ListFailureJob.prototype,
      options: {},
    };
    triggerRegistry.register(metadata);

    const list = vi.fn().mockRejectedValue(new Error("list failed"));
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
      webhookUrl: "https://api.example.com/webhooks/qstash",
    });

    await expect(scheduler.sync()).rejects.toThrow("list failed");
    expect(create).not.toHaveBeenCalled();
    expect(deleteSchedule).not.toHaveBeenCalled();
  });

  it("목록 조회 성공 시 신규 스케줄을 생성해야 한다", async () => {
    class NewScheduleJob {
      async processQueue(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: "cron",
      expression: "*/5 * * * *",
      methodName: "processQueue",
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
      webhookUrl: "https://api.example.com/webhooks/qstash",
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
        cron: "*/5 * * * *",
        destination: "https://api.example.com/webhooks/qstash",
        method: "POST",
        body: expect.any(String),
        headers: expect.objectContaining({
          "X-Schedule-Id": "croco-trigger:NewScheduleJob:processQueue:processQueue",
        }),
      }),
    );

    const payload = JSON.parse(create.mock.calls[0]?.[0]?.body as string) as {
      scheduleId: string;
      triggerName?: string;
      methodName: string;
    };

    expect(payload).toMatchObject({
      scheduleId: "croco-trigger:NewScheduleJob:processQueue:processQueue",
      triggerName: "processQueue",
      methodName: "processQueue",
    });
    expect(deleteSchedule).not.toHaveBeenCalled();
  });

  it("명시적 cron name을 schedule 식별자로 사용해야 한다", async () => {
    class NamedScheduleJob {
      async processQueue(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: "cron",
      expression: "*/10 * * * *",
      methodName: "processQueue",
      target: NamedScheduleJob.prototype,
      options: {
        name: "queue-drain",
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
      webhookUrl: "https://api.example.com/webhooks/qstash",
    });

    await scheduler.sync();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Schedule-Id": "croco-trigger:NamedScheduleJob:queue-drain:processQueue",
        }),
      }),
    );

    const payload = JSON.parse(create.mock.calls[0]?.[0]?.body as string) as {
      scheduleId: string;
      triggerName?: string;
      className?: string;
    };

    expect(payload).toMatchObject({
      scheduleId: "croco-trigger:NamedScheduleJob:queue-drain:processQueue",
      triggerName: "queue-drain",
      className: "NamedScheduleJob",
    });
  });

  it("스케줄 생성 실패를 failed로 집계해야 한다", async () => {
    class FailingScheduleJob {
      async processQueue(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: "cron",
      expression: "*/5 * * * *",
      methodName: "processQueue",
      target: FailingScheduleJob.prototype,
      options: {},
    };
    triggerRegistry.register(metadata);

    const create = vi.fn().mockRejectedValue(new Error("create failed"));
    const client = {
      schedules: {
        list: vi.fn().mockResolvedValue([]),
        create,
        delete: vi.fn(),
      },
    } as unknown as Client;

    const scheduler = new QStashScheduler({
      client,
      webhookUrl: "https://api.example.com/webhooks/qstash",
    });

    const result = await scheduler.sync();

    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.details).toEqual([
      expect.objectContaining({
        name: "croco-trigger:FailingScheduleJob:processQueue:processQueue",
        action: "failed",
        error: "create failed",
      }),
    ]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("삭제 실패를 deleted가 아니라 failed로 집계해야 한다", async () => {
    const client = {
      schedules: {
        list: vi.fn().mockResolvedValue([
          {
            scheduleId: "croco-trigger:OrphanJob:orphan:run",
            cron: "* * * * *",
          },
        ]),
        create: vi.fn(),
        delete: vi.fn().mockRejectedValue(new Error("delete failed")),
      },
    } as unknown as Client;

    const scheduler = new QStashScheduler({
      client,
      webhookUrl: "https://api.example.com/webhooks/qstash",
    });

    const result = await scheduler.sync();

    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.details).toEqual([
      expect.objectContaining({
        name: "croco-trigger:OrphanJob:orphan:run",
        action: "failed",
        error: "delete failed",
      }),
    ]);
  });

  it("cron 변경 시 delete 없이 같은 scheduleId로 갱신해야 한다", async () => {
    class UpdatedScheduleJob {
      async processQueue(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: "cron",
      expression: "*/10 * * * *",
      methodName: "processQueue",
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
            scheduleId: "croco-trigger:UpdatedScheduleJob:processQueue:processQueue",
            cron: "*/5 * * * *",
          },
        ]),
        create,
        delete: deleteSchedule,
      },
    } as unknown as Client;

    const scheduler = new QStashScheduler({
      client,
      webhookUrl: "https://api.example.com/webhooks/qstash",
    });

    const result = await scheduler.sync();

    expect(result.mode).toBe("apply");
    expect(result.applied).toBe(true);
    expect(result.updated).toBe(1);
    expect(result.failed).toBe(0);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: "croco-trigger:UpdatedScheduleJob:processQueue:processQueue",
        cron: "*/10 * * * *",
      }),
    );
    expect(deleteSchedule).not.toHaveBeenCalled();
  });

  it("dry-run은 create/update/delete diff를 반환하지만 QStash를 변경하지 않아야 한다", async () => {
    class NewDryRunScheduleJob {
      async run(): Promise<void> {}
    }

    class UpdatedDryRunScheduleJob {
      async run(): Promise<void> {}
    }

    triggerRegistry.register({
      type: "cron",
      expression: "*/5 * * * *",
      methodName: "run",
      target: NewDryRunScheduleJob.prototype,
      options: {},
    });
    triggerRegistry.register({
      type: "cron",
      expression: "*/10 * * * *",
      methodName: "run",
      target: UpdatedDryRunScheduleJob.prototype,
      options: {},
    });

    const create = vi.fn().mockResolvedValue({});
    const deleteSchedule = vi.fn().mockResolvedValue({});
    const client = {
      schedules: {
        list: vi.fn().mockResolvedValue([
          {
            scheduleId: "croco-trigger:UpdatedDryRunScheduleJob:run:run",
            cron: "*/30 * * * *",
          },
          {
            scheduleId: "croco-trigger:OrphanDryRunScheduleJob:run:run",
            cron: "0 * * * *",
          },
        ]),
        create,
        delete: deleteSchedule,
      },
    } as unknown as Client;

    const scheduler = new QStashScheduler({
      client,
      webhookUrl: "https://api.example.com/webhooks/qstash",
    });

    const result = await scheduler.sync({ mode: "dry-run" });

    expect(result).toEqual(
      expect.objectContaining({
        mode: "dry-run",
        applied: false,
        created: 1,
        updated: 1,
        deleted: 1,
        skipped: 0,
        failed: 0,
      }),
    );
    expect(result.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "croco-trigger:NewDryRunScheduleJob:run:run",
          action: "created",
          applied: false,
          expression: "*/5 * * * *",
        }),
        expect.objectContaining({
          name: "croco-trigger:UpdatedDryRunScheduleJob:run:run",
          action: "updated",
          applied: false,
          expression: "*/10 * * * *",
          currentExpression: "*/30 * * * *",
        }),
        expect.objectContaining({
          name: "croco-trigger:OrphanDryRunScheduleJob:run:run",
          action: "deleted",
          applied: false,
          currentExpression: "0 * * * *",
        }),
      ]),
    );
    expect(create).not.toHaveBeenCalled();
    expect(deleteSchedule).not.toHaveBeenCalled();
  });

  it("cron 변경 갱신 실패 시 기존 스케줄 삭제를 시도하지 않아야 한다", async () => {
    class FailingUpdateScheduleJob {
      async processQueue(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: "cron",
      expression: "*/10 * * * *",
      methodName: "processQueue",
      target: FailingUpdateScheduleJob.prototype,
      options: {},
    };
    triggerRegistry.register(metadata);

    const create = vi.fn().mockRejectedValue(new Error("update failed"));
    const deleteSchedule = vi.fn();
    const client = {
      schedules: {
        list: vi.fn().mockResolvedValue([
          {
            scheduleId: "croco-trigger:FailingUpdateScheduleJob:processQueue:processQueue",
            cron: "*/5 * * * *",
          },
        ]),
        create,
        delete: deleteSchedule,
      },
    } as unknown as Client;

    const scheduler = new QStashScheduler({
      client,
      webhookUrl: "https://api.example.com/webhooks/qstash",
    });

    const result = await scheduler.sync();

    expect(result.updated).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.details).toEqual([
      expect.objectContaining({
        name: "croco-trigger:FailingUpdateScheduleJob:processQueue:processQueue",
        action: "failed",
        error: "update failed",
      }),
    ]);
    expect(deleteSchedule).not.toHaveBeenCalled();
  });

  it("should fail fast when two triggers resolve to the same schedule id", async () => {
    const FirstDuplicateScheduleJob = class DuplicateScheduleJob {
      async run(): Promise<void> {}
    };

    const SecondDuplicateScheduleJob = class DuplicateScheduleJob {
      async run(): Promise<void> {}
    };

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "run",
      target: FirstDuplicateScheduleJob.prototype,
      options: {
        name: "shared",
      },
    });

    triggerRegistry.register({
      type: "cron",
      expression: "*/5 * * * *",
      methodName: "run",
      target: SecondDuplicateScheduleJob.prototype,
      options: {
        name: "shared",
      },
    });

    const client = {
      schedules: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        delete: vi.fn(),
      },
    } as unknown as Client;

    const scheduler = new QStashScheduler({
      client,
      webhookUrl: "https://api.example.com/webhooks/qstash",
    });

    await expect(scheduler.sync()).rejects.toThrow(
      "Duplicate QStash schedule ID detected: croco-trigger:DuplicateScheduleJob:shared:run",
    );
  });

  it("scheduleId 인자를 포함하여 스케줄을 생성해야 한다", async () => {
    class ScheduleIdTestJob {
      async run(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: "cron",
      expression: "*/5 * * * *",
      methodName: "run",
      target: ScheduleIdTestJob.prototype,
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
      webhookUrl: "https://api.example.com/webhooks/qstash",
    });

    const result = await scheduler.sync();

    expect(result.created).toBe(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: "croco-trigger:ScheduleIdTestJob:run:run",
        cron: "*/5 * * * *",
        destination: "https://api.example.com/webhooks/qstash",
        method: "POST",
      }),
    );
  });
});
