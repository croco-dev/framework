import { describe, expect, it } from 'vitest';
import { QuotaExceededEvent } from '../../libs/events/QuotaExceededEvent';
import { UsageRecordedEvent } from '../../libs/events/UsageRecordedEvent';

describe('Events', () => {
  describe('UsageRecordedEvent', () => {
    it('should create with correct properties', () => {
      const event = new UsageRecordedEvent('tenant-1', 'api_calls', 5, 'idem-key-123', { userId: 'user-1' });

      expect(event.tenantId).toBe('tenant-1');
      expect(event.meterId).toBe('api_calls');
      expect(event.value).toBe(5);
      expect(event.idempotencyKey).toBe('idem-key-123');
      expect(event.metadata?.userId).toBe('user-1');
    });

    it('should set eventName automatically', () => {
      const event = new UsageRecordedEvent('tenant-1', 'api_calls', 1, 'key-1');

      expect(event.eventName).toBe('UsageRecordedEvent');
    });

    it('should set timestamp automatically', () => {
      const before = new Date();
      const event = new UsageRecordedEvent('tenant-1', 'api_calls', 1, 'key-1');
      const after = new Date();

      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should work without metadata', () => {
      const event = new UsageRecordedEvent('tenant-1', 'api_calls', 1, 'key-1');

      expect(event.metadata).toBeUndefined();
    });
  });

  describe('QuotaExceededEvent', () => {
    it('should create with correct properties', () => {
      const event = new QuotaExceededEvent('tenant-1', 'api_calls', 150, 100);

      expect(event.tenantId).toBe('tenant-1');
      expect(event.meterId).toBe('api_calls');
      expect(event.currentUsage).toBe(150);
      expect(event.quota).toBe(100);
    });

    it('should set eventName automatically', () => {
      const event = new QuotaExceededEvent('tenant-1', 'api_calls', 150, 100);

      expect(event.eventName).toBe('QuotaExceededEvent');
    });

    it('should set timestamp automatically', () => {
      const before = new Date();
      const event = new QuotaExceededEvent('tenant-1', 'api_calls', 150, 100);
      const after = new Date();

      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
