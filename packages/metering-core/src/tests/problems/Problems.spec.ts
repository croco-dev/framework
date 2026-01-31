import { describe, expect, it } from 'vitest';
import { DuplicateRecordProblem } from '../../libs/problems/DuplicateRecordProblem';
import { InvalidMeterProblem } from '../../libs/problems/InvalidMeterProblem';
import { QuotaExceededProblem } from '../../libs/problems/QuotaExceededProblem';
import { RedisProblem } from '../../libs/problems/RedisProblem';

describe('Problems', () => {
  describe('QuotaExceededProblem', () => {
    it('should create with correct properties', () => {
      const problem = new QuotaExceededProblem('api_calls', 150, 100);

      expect(problem.code).toBe('metering/quota-exceeded');
      expect(problem.status).toBe(403);
      expect(problem.detail).toContain('Quota exceeded');
      expect(problem.detail).toContain('api_calls');

      const json = problem.toJSON();
      expect(json.meterId).toBe('api_calls');
      expect(json.currentUsage).toBe(150);
      expect(json.quota).toBe(100);
    });
  });

  describe('InvalidMeterProblem', () => {
    it('should create with correct properties', () => {
      const problem = new InvalidMeterProblem('unknown_meter', 'tenant-1');

      expect(problem.code).toBe('metering/invalid-meter');
      expect(problem.status).toBe(404);
      expect(problem.detail).toContain('unknown_meter');
      expect(problem.detail).toContain('tenant-1');

      const json = problem.toJSON();
      expect(json.meterId).toBe('unknown_meter');
      expect(json.tenantId).toBe('tenant-1');
    });
  });

  describe('DuplicateRecordProblem', () => {
    it('should create with correct properties', () => {
      const problem = new DuplicateRecordProblem('idem-key-123');

      expect(problem.code).toBe('metering/duplicate-record');
      expect(problem.status).toBe(409);
      expect(problem.detail).toContain('idem-key-123');

      const json = problem.toJSON();
      expect(json.idempotencyKey).toBe('idem-key-123');
    });
  });

  describe('RedisProblem', () => {
    it('should create with original error', () => {
      const originalError = new Error('Connection refused');
      const problem = new RedisProblem('ZADD', originalError);

      expect(problem.code).toBe('metering/redis-error');
      expect(problem.status).toBe(500);
      expect(problem.detail).toContain('ZADD');
      expect(problem.detail).toContain('Connection refused');

      const json = problem.toJSON();
      expect(json.operation).toBe('ZADD');
      expect(json.originalMessage).toBe('Connection refused');
    });

    it('should handle missing original error', () => {
      const problem = new RedisProblem('SET');

      expect(problem.detail).toContain('Unknown error');
    });
  });
});
