import { MetadataStorage } from '@croco/framework-context';
import { beforeEach, describe, expect, it } from 'vitest';
import { CRON_METADATA_KEY, Cron } from '../libs/decorators/Cron';
import { EVENT_METADATA_KEY, OnEvent } from '../libs/decorators/OnEvent';
import { OnWebhook, WEBHOOK_METADATA_KEY } from '../libs/decorators/OnWebhook';
import {
  TRIGGER_METADATA_KEY,
  TriggerRegistry as TriggerRegistryClass,
  triggerRegistry,
} from '../libs/TriggerRegistry';

import type { CronTriggerMetadata } from '../libs/types';

describe('TriggerRegistry', () => {
  beforeEach(() => {
    MetadataStorage.clear();
    TriggerRegistryClass.getInstance();
  });

  it('should be a singleton', () => {
    const instance1 = TriggerRegistryClass.getInstance();
    const instance2 = TriggerRegistryClass.getInstance();

    expect(instance1).toBe(instance2);
  });

  it('should register cron trigger', () => {
    class TestScheduler {
      @Cron('0 0 * * *', { name: 'test-cron' })
      async dailyTask(): Promise<void> {}
    }

    const triggers = TriggerRegistryClass.getInstance().getTriggers(TestScheduler.prototype);
    expect(triggers.size).toBe(1);

    const [metadata] = Array.from(triggers.values());
    expect(metadata.type).toBe('cron');
    expect(MetadataStorage.get(CRON_METADATA_KEY, TestScheduler.prototype, 'dailyTask')).toEqual(metadata);
    expect(MetadataStorage.get(TRIGGER_METADATA_KEY, TestScheduler.prototype, 'dailyTask')).toBeUndefined();
  });

  it('should register event trigger', () => {
    class TestEventHandler {
      @OnEvent('TestEvent', { name: 'test-event' })
      async handleEvent(): Promise<void> {}
    }

    const triggers = TriggerRegistryClass.getInstance().getTriggers(TestEventHandler.prototype);
    expect(triggers.size).toBe(1);

    const [metadata] = Array.from(triggers.values());
    expect(metadata.type).toBe('event');
    expect(MetadataStorage.get(EVENT_METADATA_KEY, TestEventHandler.prototype, 'handleEvent')).toEqual(metadata);
    expect(MetadataStorage.get(TRIGGER_METADATA_KEY, TestEventHandler.prototype, 'handleEvent')).toBeUndefined();
  });

  it('should register webhook trigger', () => {
    class TestWebhookHandler {
      @OnWebhook('/webhooks/test', 'POST', { name: 'test-webhook' })
      async handleWebhook(): Promise<void> {}
    }

    const triggers = TriggerRegistryClass.getInstance().getTriggers(TestWebhookHandler.prototype);
    expect(triggers.size).toBe(1);

    const [metadata] = Array.from(triggers.values());
    expect(metadata.type).toBe('webhook');
    expect(MetadataStorage.get(WEBHOOK_METADATA_KEY, TestWebhookHandler.prototype, 'handleWebhook')).toEqual(metadata);
    expect(MetadataStorage.get(TRIGGER_METADATA_KEY, TestWebhookHandler.prototype, 'handleWebhook')).toBeUndefined();
  });

  it('should get all triggers for a target', () => {
    class MixedTriggerHandler {
      @Cron('0 0 * * *')
      async cronMethod(): Promise<void> {}

      @OnEvent('EventA')
      async eventMethod(): Promise<void> {}

      @OnWebhook('/webhooks/test', 'POST')
      async webhookMethod(): Promise<void> {}
    }

    const triggers = TriggerRegistryClass.getInstance().getTriggers(MixedTriggerHandler.prototype);
    expect(triggers.size).toBe(3);

    const types = Array.from(triggers.values()).map((m) => m.type);
    expect(types).toContain('cron');
    expect(types).toContain('event');
    expect(types).toContain('webhook');
  });

  it('should filter triggers by type', () => {
    class MixedTriggerHandler {
      @Cron('0 0 * * *')
      async cronMethod(): Promise<void> {}

      @Cron('*/5 * * * *')
      async anotherCronMethod(): Promise<void> {}

      @OnEvent('EventA')
      async eventMethod(): Promise<void> {}

      @OnWebhook('/webhooks/test', 'POST')
      async webhookMethod(): Promise<void> {}
    }

    const cronTriggers = TriggerRegistryClass.getInstance().getTriggersByType(MixedTriggerHandler.prototype, 'cron');
    expect(cronTriggers.size).toBe(2);

    const eventTriggers = TriggerRegistryClass.getInstance().getTriggersByType(MixedTriggerHandler.prototype, 'event');
    expect(eventTriggers.size).toBe(1);

    const webhookTriggers = TriggerRegistryClass.getInstance().getTriggersByType(
      MixedTriggerHandler.prototype,
      'webhook'
    );
    expect(webhookTriggers.size).toBe(1);
  });

  it('should get all triggers across all targets', () => {
    class Handler1 {
      @Cron('0 0 * * *')
      async method1(): Promise<void> {}
    }

    class Handler2 {
      @OnEvent('EventA')
      async method2(): Promise<void> {}
    }

    class Handler3 {
      @OnWebhook('/webhooks/test', 'POST')
      async method3(): Promise<void> {}
    }

    const allTriggers = TriggerRegistryClass.getInstance().getAllTriggers();
    expect(allTriggers.size).toBe(3);
    expect(allTriggers.has(Handler1.prototype)).toBe(true);
    expect(allTriggers.has(Handler2.prototype)).toBe(true);
    expect(allTriggers.has(Handler3.prototype)).toBe(true);

    let totalTriggerCount = 0;
    for (const [, triggers] of allTriggers) {
      totalTriggerCount += triggers.size;
    }
    expect(totalTriggerCount).toBe(3);
  });

  it('should return empty map for target with no triggers', () => {
    class NoTriggerHandler {
      async regularMethod(): Promise<void> {}
    }

    const triggers = TriggerRegistryClass.getInstance().getTriggers(NoTriggerHandler.prototype);
    expect(triggers.size).toBe(0);
  });

  it('should export triggerRegistry instance', () => {
    expect(triggerRegistry).not.toBeUndefined();
    expect(triggerRegistry).toBeInstanceOf(TriggerRegistryClass);
  });

  it('should export TRIGGER_METADATA_KEY symbol', () => {
    expect(typeof TRIGGER_METADATA_KEY).toBe('symbol');
  });

  it('should handle multiple classes with same method names', () => {
    class Handler1 {
      @Cron('0 0 * * *')
      async execute(): Promise<void> {}
    }

    class Handler2 {
      @Cron('*/5 * * * *')
      async execute(): Promise<void> {}
    }

    const triggers1 = TriggerRegistryClass.getInstance().getTriggers(Handler1.prototype);
    const triggers2 = TriggerRegistryClass.getInstance().getTriggers(Handler2.prototype);

    expect(triggers1.size).toBe(1);
    expect(triggers2.size).toBe(1);

    const metadata1 = Array.from(triggers1.values())[0] as CronTriggerMetadata;
    const metadata2 = Array.from(triggers2.values())[0] as CronTriggerMetadata;

    expect(metadata1.expression).toBe('0 0 * * *');
    expect(metadata2.expression).toBe('*/5 * * * *');
  });

  it('should preserve trigger options', () => {
    class HandlerWithOptions {
      @Cron('0 0 * * *', {
        name: 'scheduled-task',
        description: 'Daily scheduled task',
        enabled: true,
        timezone: 'UTC',
      })
      async task(): Promise<void> {}
    }

    const triggers = TriggerRegistryClass.getInstance().getTriggers(HandlerWithOptions.prototype);
    const [metadata] = Array.from(triggers.values()) as CronTriggerMetadata[];

    expect(metadata.options).toEqual({
      name: 'scheduled-task',
      description: 'Daily scheduled task',
      enabled: true,
      timezone: 'UTC',
    });
  });

  it('should handle symbol method names in getAllTriggers', () => {
    const methodSymbol = Symbol('symbolHandler');

    class SymbolHandler {
      @Cron('0 0 * * *')
      async [methodSymbol](): Promise<void> {}
    }

    const allTriggers = TriggerRegistryClass.getInstance().getAllTriggers();
    const symbolClassTriggers = allTriggers.get(SymbolHandler.prototype);

    expect(symbolClassTriggers).not.toBeUndefined();
    expect(symbolClassTriggers?.has(methodSymbol)).toBe(true);
  });

  it('should isolate stored metadata from later caller mutations', () => {
    type MutableCronMetadata = {
      type: 'cron';
      expression: string;
      methodName: string | symbol;
      options?: {
        name?: string;
        timezone?: string;
      };
      target: object;
    };

    class ManualHandler {
      async run(): Promise<void> {}
    }

    const metadata: CronTriggerMetadata = {
      type: 'cron',
      expression: '0 0 * * *',
      methodName: 'run',
      options: {
        name: 'before-mutation',
        timezone: 'UTC',
      },
      target: ManualHandler.prototype,
    };

    TriggerRegistryClass.getInstance().register(metadata);

    const mutableMetadata = metadata as unknown as MutableCronMetadata;

    mutableMetadata.expression = '*/5 * * * *';
    mutableMetadata.options = {
      name: 'after-mutation',
      timezone: 'Asia/Seoul',
    };

    const stored = TriggerRegistryClass.getInstance()
      .getTriggers(ManualHandler.prototype)
      .get('run') as CronTriggerMetadata;

    expect(stored.expression).toBe('0 0 * * *');
    expect(stored.options).toEqual({
      name: 'before-mutation',
      timezone: 'UTC',
    });
  });

  it('should isolate registry state from returned metadata mutations', () => {
    type MutableWebhookMetadata = {
      type: 'webhook';
      path: string;
      options?: {
        cors?: {
          origin?: string[];
          methods?: string[];
          allowedHeaders?: string[];
        };
      };
    };

    class WebhookHandler {
      @OnWebhook('/webhooks/test', 'POST', {
        cors: {
          origin: ['https://app1.com'],
          methods: ['POST'],
          allowedHeaders: ['content-type'],
        },
      })
      async handle(): Promise<void> {}
    }

    const firstRead = TriggerRegistryClass.getInstance().getTriggers(WebhookHandler.prototype).get('handle');
    if (!firstRead || firstRead.type !== 'webhook' || !firstRead.options?.cors) {
      throw new Error('Expected webhook metadata to exist');
    }

    const mutableFirstRead = firstRead as unknown as MutableWebhookMetadata;

    mutableFirstRead.path = '/mutated';
    mutableFirstRead.options ??= {};
    mutableFirstRead.options.cors ??= {};
    mutableFirstRead.options.cors.origin = ['https://mutated.example.com'];
    mutableFirstRead.options.cors.methods = ['GET'];

    const secondRead = TriggerRegistryClass.getInstance().getTriggers(WebhookHandler.prototype).get('handle');
    expect(secondRead).toMatchObject({
      type: 'webhook',
      path: '/webhooks/test',
      options: {
        cors: {
          origin: ['https://app1.com'],
          methods: ['POST'],
          allowedHeaders: ['content-type'],
        },
      },
    });
  });

  it('should return cloned metadata for getTriggers', () => {
    class MutableMetadataHandler {
      @Cron('0 0 * * *', {
        name: 'original-name',
        description: 'original description',
        enabled: true,
        timezone: 'UTC',
      })
      async task(): Promise<void> {}
    }

    const registry = TriggerRegistryClass.getInstance();
    const triggers = registry.getTriggers(MutableMetadataHandler.prototype);

    const metadata = Array.from(triggers.values())[0] as Record<string, unknown>;
    metadata.type = 'event';
    const options = (metadata.options as Record<string, unknown>) ?? {};
    options.name = 'mutated-name';

    const stored = MetadataStorage.get(CRON_METADATA_KEY, MutableMetadataHandler.prototype, 'task') as
      | Record<string, unknown>
      | undefined;

    expect(stored?.type).toBe('cron');
    expect((stored?.options as Record<string, unknown>)?.name).toBe('original-name');
  });

  it('should return cloned metadata in getTriggersByType', () => {
    class MutableCronHandler {
      @Cron('*/10 * * * *', { name: 'event-target' })
      async cronTask(): Promise<void> {}
    }

    const registry = TriggerRegistryClass.getInstance();
    const cronTriggers = registry.getTriggersByType(MutableCronHandler.prototype, 'cron');

    const metadata = cronTriggers.get('cronTask') as Record<string, unknown>;
    const options = (metadata.options as Record<string, unknown>) ?? {};
    options.timezone = 'Europe/Paris';

    const stored = MetadataStorage.get(CRON_METADATA_KEY, MutableCronHandler.prototype, 'cronTask') as
      | Record<string, unknown>
      | undefined;

    expect((stored?.options as Record<string, unknown>)?.name).toBe('event-target');
    expect((stored?.options as Record<string, unknown>)?.timezone).toBeUndefined();
  });

  it('should return deep-cloned metadata in getAllTriggers', () => {
    class NestedWebhookHandler {
      @OnWebhook('/webhooks/sample', 'POST', {
        name: 'webhook-original',
        cors: {
          origin: 'https://original.example',
          methods: ['POST'],
          allowedHeaders: ['Content-Type'],
        },
      })
      async hook(): Promise<void> {}
    }

    const allTriggers = TriggerRegistryClass.getInstance().getAllTriggers();
    const targetMap = allTriggers.get(NestedWebhookHandler.prototype);

    expect(targetMap).not.toBeUndefined();

    const metadata = targetMap?.get('hook') as Record<string, unknown> | undefined;
    const options = metadata?.options as Record<string, unknown>;
    const cors = options?.cors as Record<string, unknown>;
    const methods = cors?.methods as string[];

    methods?.push('GET');

    const stored = MetadataStorage.get(WEBHOOK_METADATA_KEY, NestedWebhookHandler.prototype, 'hook') as
      | Record<string, unknown>
      | undefined;
    const storedCors = stored?.options as Record<string, unknown>;
    const storedMethods = (storedCors?.cors as Record<string, unknown>)?.methods as string[];

    expect(storedMethods).toEqual(['POST']);
    expect(metadata?.type).toBe('webhook');
  });
});
