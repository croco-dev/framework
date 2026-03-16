import type { EventBus } from '@croco/events-core';
import { DomainEvent } from '@croco/events-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionalEventPublisher } from '../libs/TransactionalEventPublisher';

class TestEvent extends DomainEvent {
  static eventName = 'TestEvent';

  constructor(public readonly data: string) {
    super();
  }
}

describe('TransactionalEventPublisher', () => {
  let publisher!: TransactionalEventPublisher;
  let publishedEvents!: DomainEvent[];

  beforeEach(() => {
    publishedEvents = [];
    const eventBus: EventBus = {
      publish: async (event: DomainEvent) => {
        publishedEvents.push(event);
      },
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      clear: vi.fn(),
    };
    publisher = new TransactionalEventPublisher(eventBus);
  });

  describe('begin', () => {
    it('should start a new transaction', () => {
      expect(() => publisher.begin('tx-1')).not.toThrow();
    });

    it('should throw when starting an already-active transaction', () => {
      publisher.begin('tx-1');
      expect(() => publisher.begin('tx-1')).toThrow("Transaction 'tx-1' already started");
    });
  });

  describe('stage', () => {
    it('should buffer events without publishing', () => {
      publisher.begin('tx-1');
      publisher.stage('tx-1', new TestEvent('hello'));
      expect(publishedEvents).toHaveLength(0);
    });

    it('should throw when staging to a non-existent transaction', () => {
      expect(() => publisher.stage('unknown', new TestEvent('x'))).toThrow("Transaction 'unknown' not found");
    });
  });

  describe('commit', () => {
    it('should publish all staged events in order', async () => {
      publisher.begin('tx-1');
      publisher.stage('tx-1', new TestEvent('first'));
      publisher.stage('tx-1', new TestEvent('second'));
      await publisher.commit('tx-1');

      expect(publishedEvents).toHaveLength(2);
      expect((publishedEvents[0] as TestEvent).data).toBe('first');
      expect((publishedEvents[1] as TestEvent).data).toBe('second');
    });

    it('should clean up transaction after commit', async () => {
      publisher.begin('tx-1');
      await publisher.commit('tx-1');
      await expect(publisher.commit('tx-1')).rejects.toThrow("Transaction 'tx-1' not found");
    });

    it('should throw when committing a non-existent transaction', async () => {
      await expect(publisher.commit('no-such')).rejects.toThrow("Transaction 'no-such' not found");
    });

    it('should keep remaining events when publish fails and allow retry', async () => {
      let failedOnce = false;
      const flakyEventBus: EventBus = {
        publish: async (event: DomainEvent) => {
          const data = (event as TestEvent).data;
          if (data === 'second' && !failedOnce) {
            failedOnce = true;
            throw new Error('publish failed');
          }
          publishedEvents.push(event);
        },
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        clear: vi.fn(),
      };
      publisher = new TransactionalEventPublisher(flakyEventBus);

      publisher.begin('tx-1');
      publisher.stage('tx-1', new TestEvent('first'));
      publisher.stage('tx-1', new TestEvent('second'));
      publisher.stage('tx-1', new TestEvent('third'));

      await expect(publisher.commit('tx-1')).rejects.toThrow('publish failed');
      expect(publishedEvents.map((event) => (event as TestEvent).data)).toEqual(['first']);

      await expect(publisher.commit('tx-1')).resolves.toBeUndefined();
      expect(publishedEvents.map((event) => (event as TestEvent).data)).toEqual(['first', 'second', 'third']);
      await expect(publisher.commit('tx-1')).rejects.toThrow("Transaction 'tx-1' not found");
    });
  });

  describe('rollback', () => {
    it('should discard all staged events', async () => {
      publisher.begin('tx-1');
      publisher.stage('tx-1', new TestEvent('should-be-dropped'));
      publisher.rollback('tx-1');

      expect(publishedEvents).toHaveLength(0);
    });

    it('should be a no-op for a non-existent transaction', () => {
      expect(() => publisher.rollback('ghost')).not.toThrow();
    });

    it('should allow restarting the same txId after rollback', () => {
      publisher.begin('tx-1');
      publisher.rollback('tx-1');
      expect(() => publisher.begin('tx-1')).not.toThrow();
    });
  });

  describe('isolation', () => {
    it('should keep events from different transactions isolated', async () => {
      publisher.begin('tx-a');
      publisher.begin('tx-b');
      publisher.stage('tx-a', new TestEvent('a'));
      publisher.stage('tx-b', new TestEvent('b'));

      publisher.rollback('tx-a');
      await publisher.commit('tx-b');

      expect(publishedEvents).toHaveLength(1);
      expect((publishedEvents[0] as TestEvent).data).toBe('b');
    });
  });
});
