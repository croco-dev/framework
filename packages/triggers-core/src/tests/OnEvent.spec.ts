import { beforeEach, describe, expect, it } from 'vitest';
import { EVENT_METADATA_KEY, OnEvent } from '../libs/decorators/OnEvent';
import { TriggerRegistry } from '../libs/TriggerRegistry';
import type { EventTriggerMetadata } from '../libs/types';

describe('@OnEvent decorator', () => {
  beforeEach(() => {
    TriggerRegistry.getInstance();
  });

  it('should register event trigger metadata', () => {
    class TestEventHandler {
      @OnEvent('OrderPlaced')
      async handleOrderPlaced(event: unknown): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(TestEventHandler.prototype);
    expect(triggers.size).toBe(1);

    const [metadata] = Array.from(triggers.values());
    expect(metadata.type).toBe('event');
    expect((metadata as EventTriggerMetadata).event).toBe('OrderPlaced');
    expect(metadata.methodName).toBe('handleOrderPlaced');
  });

  it('should store custom options', () => {
    class TestEventHandler {
      @OnEvent('PaymentFailed', {
        name: 'payment-failure-handler',
        description: 'Handle payment failure events',
        enabled: true,
        concurrency: 5,
        timeout: 10000,
      })
      async handlePaymentFailure(event: unknown): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(TestEventHandler.prototype);
    const [metadata] = Array.from(triggers.values());

    expect(metadata.options).toEqual({
      name: 'payment-failure-handler',
      description: 'Handle payment failure events',
      enabled: true,
      concurrency: 5,
      timeout: 10000,
    });
  });

  it('should handle multiple event handlers on same class', () => {
    class MultiEventHandler {
      @OnEvent('OrderPlaced', { name: 'order-placed' })
      async onOrderPlaced(): Promise<void> {}

      @OnEvent('OrderCancelled', { name: 'order-cancelled' })
      async onOrderCancelled(): Promise<void> {}

      @OnEvent('OrderShipped', { name: 'order-shipped' })
      async onOrderShipped(): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(MultiEventHandler.prototype);
    expect(triggers.size).toBe(3);

    const events = Array.from(triggers.values()).map((m) => (m as EventTriggerMetadata).event);
    expect(events).toContain('OrderPlaced');
    expect(events).toContain('OrderCancelled');
    expect(events).toContain('OrderShipped');
  });

  it('should handle same event with multiple handlers', () => {
    class MultiHandlerSameEvent {
      @OnEvent('UserCreated', { name: 'send-welcome-email' })
      async sendWelcomeEmail(): Promise<void> {}

      @OnEvent('UserCreated', { name: 'create-user-profile' })
      async createUserProfile(): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(MultiHandlerSameEvent.prototype);
    expect(triggers.size).toBe(2);

    const events = Array.from(triggers.values()).map((m) => (m as EventTriggerMetadata).event);
    expect(events.filter((e) => e === 'UserCreated')).toHaveLength(2);
  });

  it('should support symbol method names', () => {
    const methodSymbol = Symbol('eventHandler');

    class TestEventHandler {
      @OnEvent('CustomEvent', { name: 'symbol-handler' })
      async [methodSymbol](event: unknown): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(TestEventHandler.prototype);
    expect(triggers.has(methodSymbol)).toBe(true);

    const metadata = triggers.get(methodSymbol);
    expect(metadata?.type).toBe('event');
    expect(metadata?.methodName).toBe(methodSymbol);
  });

  it('should filter triggers by event type', () => {
    class MixedEventHandler {
      @OnEvent('EventA')
      async handleEventA(): Promise<void> {}

      @OnEvent('EventB')
      async handleEventB(): Promise<void> {}
    }

    const eventTriggers = TriggerRegistry.getInstance().getTriggersByType(MixedEventHandler.prototype, 'event');
    expect(eventTriggers.size).toBe(2);

    const cronTriggers = TriggerRegistry.getInstance().getTriggersByType(MixedEventHandler.prototype, 'cron');
    expect(cronTriggers.size).toBe(0);
  });

  it('should preserve original method behavior', async () => {
    let callCount = 0;

    class TestEventHandler {
      @OnEvent('TestEvent')
      async handleEvent(payload: string): Promise<string> {
        callCount++;
        return `processed: ${payload}`;
      }
    }

    const handler = new TestEventHandler();
    const result = await handler.handleEvent('test-payload');

    expect(result).toBe('processed: test-payload');
    expect(callCount).toBe(1);
  });

  it('should export EVENT_METADATA_KEY symbol', () => {
    expect(typeof EVENT_METADATA_KEY).toBe('symbol');
  });

  it('should support default options (empty object)', () => {
    class TestEventHandler {
      @OnEvent('SimpleEvent')
      async handle(): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(TestEventHandler.prototype);
    const [metadata] = Array.from(triggers.values());

    expect(metadata.options).toEqual({});
  });
});
