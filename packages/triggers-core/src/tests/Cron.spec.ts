import { beforeEach, describe, expect, it } from 'vitest';
import { CRON_METADATA_KEY, Cron } from '../libs/decorators/Cron';
import { TriggerRegistry } from '../libs/TriggerRegistry';
import type { CronTriggerMetadata } from '../libs/types';

describe('@Cron decorator', () => {
  beforeEach(() => {
    TriggerRegistry.getInstance();
  });

  it('should register cron trigger metadata', () => {
    class TestScheduler {
      @Cron('0 0 * * *')
      async dailyTask(): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(TestScheduler.prototype);
    expect(triggers.size).toBe(1);

    const [metadata] = Array.from(triggers.values());
    expect(metadata.type).toBe('cron');
    expect((metadata as CronTriggerMetadata).expression).toBe('0 0 * * *');
    expect(metadata.methodName).toBe('dailyTask');
  });

  it('should store custom options', () => {
    class TestScheduler {
      @Cron('*/5 * * * *', {
        name: 'health-check',
        description: 'System health check task',
        enabled: true,
        timezone: 'Asia/Seoul',
      })
      async healthCheck(): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(TestScheduler.prototype);
    const [metadata] = Array.from(triggers.values());

    expect(metadata.options).toEqual({
      name: 'health-check',
      description: 'System health check task',
      enabled: true,
      timezone: 'Asia/Seoul',
    });
  });

  it('should handle multiple cron triggers on same class', () => {
    class MultiScheduler {
      @Cron('0 0 * * *', { name: 'daily' })
      async daily(): Promise<void> {}

      @Cron('0 */6 * * *', { name: 'six-hourly' })
      async sixHourly(): Promise<void> {}

      @Cron('*/5 * * * *', { name: 'five-minutely' })
      async fiveMinutely(): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(MultiScheduler.prototype);
    expect(triggers.size).toBe(3);

    const expressions = Array.from(triggers.values()).map((m) => (m as CronTriggerMetadata).expression);
    expect(expressions).toContain('0 0 * * *');
    expect(expressions).toContain('0 */6 * * *');
    expect(expressions).toContain('*/5 * * * *');
  });

  it('should support symbol method names', () => {
    const methodSymbol = Symbol('handler');

    class TestScheduler {
      @Cron('0 0 * * *', { name: 'symbol-task' })
      async [methodSymbol](): Promise<void> {}
    }

    const triggers = TriggerRegistry.getInstance().getTriggers(TestScheduler.prototype);
    expect(triggers.has(methodSymbol)).toBe(true);

    const metadata = triggers.get(methodSymbol);
    expect(metadata?.type).toBe('cron');
    expect(metadata?.methodName).toBe(methodSymbol);
  });

  it('should filter triggers by type', () => {
    class MixedScheduler {
      @Cron('0 0 * * *')
      async cronMethod(): Promise<void> {}
    }

    const cronTriggers = TriggerRegistry.getInstance().getTriggersByType(MixedScheduler.prototype, 'cron');
    expect(cronTriggers.size).toBe(1);

    const eventTriggers = TriggerRegistry.getInstance().getTriggersByType(MixedScheduler.prototype, 'event');
    expect(eventTriggers.size).toBe(0);
  });

  it('should preserve original method behavior', async () => {
    let executionCount = 0;

    class TestScheduler {
      @Cron('0 0 * * *')
      async increment(): Promise<number> {
        executionCount++;
        return executionCount;
      }
    }

    const scheduler = new TestScheduler();
    const result1 = await scheduler.increment();
    const result2 = await scheduler.increment();

    expect(result1).toBe(1);
    expect(result2).toBe(2);
  });

  it('should export CRON_METADATA_KEY symbol', () => {
    expect(CRON_METADATA_KEY).not.toBeUndefined();
    expect(typeof CRON_METADATA_KEY).toBe('symbol');
  });
});
