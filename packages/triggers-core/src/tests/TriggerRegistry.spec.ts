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
});
