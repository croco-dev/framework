import { describe, expect, it } from 'vitest';
import { CRON_METADATA_KEY, Cron } from '../libs/decorators/Cron';
import { EVENT_METADATA_KEY, OnEvent } from '../libs/decorators/OnEvent';
import { OnWebhook, WEBHOOK_METADATA_KEY } from '../libs/decorators/OnWebhook';
import { TRIGGER_METADATA_KEY, TriggerRegistry, triggerRegistry } from '../libs/TriggerRegistry';
import type {
  AnyTriggerMetadata,
  CronOptions,
  CronTriggerMetadata,
  EventOptions,
  EventTriggerMetadata,
  TriggerMetadata,
  TriggerType,
  WebhookOptions,
  WebhookTriggerMetadata,
} from '../libs/types';

describe('@croco/triggers-core package exports', () => {
  it('should export Cron decorator', () => {
    expect(Cron).toBeDefined();
    expect(typeof Cron).toBe('function');
  });

  it('should export CRON_METADATA_KEY symbol', () => {
    expect(CRON_METADATA_KEY).toBeDefined();
    expect(typeof CRON_METADATA_KEY).toBe('symbol');
  });

  it('should export OnEvent decorator', () => {
    expect(OnEvent).toBeDefined();
    expect(typeof OnEvent).toBe('function');
  });

  it('should export EVENT_METADATA_KEY symbol', () => {
    expect(EVENT_METADATA_KEY).toBeDefined();
    expect(typeof EVENT_METADATA_KEY).toBe('symbol');
  });

  it('should export OnWebhook decorator', () => {
    expect(OnWebhook).toBeDefined();
    expect(typeof OnWebhook).toBe('function');
  });

  it('should export WEBHOOK_METADATA_KEY symbol', () => {
    expect(WEBHOOK_METADATA_KEY).toBeDefined();
    expect(typeof WEBHOOK_METADATA_KEY).toBe('symbol');
  });

  it('should export TRIGGER_METADATA_KEY symbol', () => {
    expect(TRIGGER_METADATA_KEY).toBeDefined();
    expect(typeof TRIGGER_METADATA_KEY).toBe('symbol');
  });

  it('should export TriggerRegistry class', () => {
    expect(TriggerRegistry).toBeDefined();
    expect(typeof TriggerRegistry).toBe('function');
    expect(typeof TriggerRegistry.getInstance).toBe('function');
  });

  it('should export triggerRegistry instance', () => {
    expect(triggerRegistry).toBeDefined();
    expect(triggerRegistry).toBeInstanceOf(TriggerRegistry);
  });

  it('should export TriggerType type', () => {
    const typeCheck1: TriggerType = 'cron';
    const typeCheck2: TriggerType = 'event';
    const typeCheck3: TriggerType = 'webhook';
    expect([typeCheck1, typeCheck2, typeCheck3]).toBeDefined();
  });

  it('should export TriggerMetadata type', () => {
    const typeCheck: TriggerMetadata = {
      type: 'cron',
      methodName: 'testMethod',
      target: class Test {},
    };
    expect(typeCheck).toBeDefined();
  });

  it('should export CronTriggerMetadata type', () => {
    const typeCheck: CronTriggerMetadata = {
      type: 'cron',
      expression: '0 0 * * *',
      methodName: 'testMethod',
      target: class Test {},
    };
    expect(typeCheck).toBeDefined();
  });

  it('should export EventTriggerMetadata type', () => {
    const typeCheck: EventTriggerMetadata = {
      type: 'event',
      event: 'TestEvent',
      methodName: 'testMethod',
      target: class Test {},
    };
    expect(typeCheck).toBeDefined();
  });

  it('should export WebhookTriggerMetadata type', () => {
    const typeCheck: WebhookTriggerMetadata = {
      type: 'webhook',
      path: '/webhooks/test',
      method: 'POST',
      methodName: 'testMethod',
      target: class Test {},
    };
    expect(typeCheck).toBeDefined();
  });

  it('should export AnyTriggerMetadata type', () => {
    const typeCheck1: AnyTriggerMetadata = {
      type: 'cron',
      expression: '0 0 * * *',
      methodName: 'testMethod',
      target: class Test {},
    };
    const typeCheck2: AnyTriggerMetadata = {
      type: 'event',
      event: 'TestEvent',
      methodName: 'testMethod',
      target: class Test {},
    };
    const typeCheck3: AnyTriggerMetadata = {
      type: 'webhook',
      path: '/webhooks/test',
      method: 'POST',
      methodName: 'testMethod',
      target: class Test {},
    };
    expect([typeCheck1, typeCheck2, typeCheck3]).toBeDefined();
  });

  it('should export CronOptions type', () => {
    const typeCheck: CronOptions = {
      name: 'test-cron',
      description: 'Test cron job',
      enabled: true,
      timezone: 'UTC',
    };
    expect(typeCheck).toBeDefined();
  });

  it('should export EventOptions type', () => {
    const typeCheck: EventOptions = {
      name: 'test-event',
      description: 'Test event handler',
      enabled: true,
      concurrency: 5,
      timeout: 10000,
    };
    expect(typeCheck).toBeDefined();
  });

  it('should export WebhookOptions type', () => {
    const typeCheck: WebhookOptions = {
      name: 'test-webhook',
      description: 'Test webhook handler',
      enabled: true,
      auth: true,
      cors: {
        origin: 'https://example.com',
        methods: ['POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      },
    };
    expect(typeCheck).toBeDefined();
  });
});
