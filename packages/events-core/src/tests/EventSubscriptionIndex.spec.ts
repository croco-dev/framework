import { beforeEach, describe, expect, it } from 'vitest';
import { EventSubscriptionIndex } from '../libs/EventBus';

describe('EventSubscriptionIndex', () => {
  let index!: EventSubscriptionIndex<string>;

  beforeEach(() => {
    index = new EventSubscriptionIndex<string>();
  });

  describe('exact match', () => {
    it('should match exact event name', () => {
      index.add('user.created', 'handler1');
      const matches = index.match('user.created');
      expect(matches.size).toBe(1);
      expect(matches.has('handler1')).toBe(true);
    });

    it('should not match different exact event name', () => {
      index.add('user.created', 'handler1');
      const matches = index.match('user.updated');
      expect(matches.size).toBe(0);
    });

    it('should return all values for exact match', () => {
      index.add('user.created', 'handler1');
      index.add('user.created', 'handler2');
      const matches = index.match('user.created');
      expect(matches.size).toBe(2);
      expect(matches.has('handler1')).toBe(true);
      expect(matches.has('handler2')).toBe(true);
    });

    it('should return empty set when no match', () => {
      const matches = index.match('user.created');
      expect(matches.size).toBe(0);
    });
  });

  describe('prefix wildcard', () => {
    it('should match events with wildcard prefix (user.*)', () => {
      index.add('user.*', 'handler1');
      expect(index.match('user.created').has('handler1')).toBe(true);
      expect(index.match('user.updated').has('handler1')).toBe(true);
    });

    it('should match nested wildcard (user.event.*)', () => {
      index.add('user.event.*', 'handler1');
      expect(index.match('user.event.created').has('handler1')).toBe(true);
      expect(index.match('user.event.deleted').has('handler1')).toBe(true);
      expect(index.match('user.created').has('handler1')).toBe(false);
    });

    it('should match root wildcard (*)', () => {
      index.add('*', 'handler1');
      expect(index.match('user.created').has('handler1')).toBe(true);
      expect(index.match('anything').has('handler1')).toBe(true);
      expect(index.match('').has('handler1')).toBe(true);
    });

    it('should not match event from different prefix', () => {
      index.add('user.*', 'handler1');
      expect(index.match('order.created').has('handler1')).toBe(false);
      expect(index.match('sys.user.created').has('handler1')).toBe(false);
    });
  });

  describe('glob pattern', () => {
    it('should match glob pattern (*.created)', () => {
      index.add('*.created', 'handler1');
      expect(index.match('user.created').has('handler1')).toBe(true);
      expect(index.match('order.created').has('handler1')).toBe(true);
      expect(index.match('created').has('handler1')).toBe(false);
      expect(index.match('user.updated').has('handler1')).toBe(false);
    });

    it('should match complex glob (user.*.created)', () => {
      index.add('user.*.created', 'handler1');
      expect(index.match('user.order.created').has('handler1')).toBe(true);
      expect(index.match('user.profile.created').has('handler1')).toBe(true);
      expect(index.match('user.created').has('handler1')).toBe(false);
      expect(index.match('order.created').has('handler1')).toBe(false);
    });

    it('should not match glob if pattern does not match', () => {
      index.add('*.created', 'handler1');
      expect(index.match('user.updated').has('handler1')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove specific value from exact match', () => {
      index.add('user.created', 'handler1');
      index.add('user.created', 'handler2');
      index.delete('user.created', 'handler1');

      const matches = index.match('user.created');
      expect(matches.size).toBe(1);
      expect(matches.has('handler2')).toBe(true);
    });

    it('should remove specific value from prefix wildcard', () => {
      index.add('user.*', 'handler1');
      index.add('user.*', 'handler2');
      index.delete('user.*', 'handler1');

      const matches = index.match('user.created');
      expect(matches.size).toBe(1);
      expect(matches.has('handler2')).toBe(true);
    });

    it('should not affect other values when deleting one', () => {
      index.add('user.created', 'handler1');
      index.add('*.created', 'handler1');
      index.delete('user.created', 'handler1');

      const matches = index.match('order.created');
      expect(matches.size).toBe(1);
      expect(matches.has('handler1')).toBe(true);

      const exactMatches = index.match('user.created');
      expect(exactMatches.size).toBe(1);
      expect(exactMatches.has('handler1')).toBe(true);
    });

    it('should handle delete of non-existent entry gracefully', () => {
      index.add('user.created', 'handler1');
      index.delete('user.updated', 'handler1'); // non-existent pattern
      index.delete('user.created', 'handler2'); // non-existent value

      const matches = index.match('user.created');
      expect(matches.size).toBe(1);
      expect(matches.has('handler1')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all subscriptions', () => {
      index.add('user.created', 'handler1');
      index.add('user.*', 'handler2');
      index.add('*.created', 'handler3');

      index.clear();

      expect(index.match('user.created').size).toBe(0);
      expect(index.match('order.updated').size).toBe(0);
    });

    it('should return empty set after clear', () => {
      index.add('user.created', 'handler1');
      index.clear();

      const matches = index.match('user.created');
      expect(matches.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string event name', () => {
      index.add('', 'handler1');
      const matches = index.match('');
      expect(matches.size).toBe(1);
      expect(matches.has('handler1')).toBe(true);
    });

    it('should accumulate matches from multiple match types', () => {
      index.add('user.created', 'handler-exact');
      index.add('user.*', 'handler-prefix');
      index.add('*.created', 'handler-glob');
      index.add('*', 'handler-root');

      const matches = index.match('user.created');
      expect(matches.size).toBe(4);
      expect(matches.has('handler-exact')).toBe(true);
      expect(matches.has('handler-prefix')).toBe(true);
      expect(matches.has('handler-glob')).toBe(true);
      expect(matches.has('handler-root')).toBe(true);
    });
  });
});
