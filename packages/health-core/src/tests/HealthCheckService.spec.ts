import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthCheckService } from '../libs/HealthCheckService';
import type { HealthIndicator, HealthIndicatorResult } from '../libs/HealthIndicator';

describe('HealthCheckService', () => {
  let service!: HealthCheckService;

  beforeEach(() => {
    service = new HealthCheckService();
  });

  it('should return up status when all indicators are up', async () => {
    const indicator1: HealthIndicator = {
      check: vi.fn().mockResolvedValue({ name: 'indicator1', status: 'up' }),
    };
    const indicator2: HealthIndicator = {
      check: vi.fn().mockResolvedValue({ name: 'indicator2', status: 'up' }),
    };

    service.register(indicator1);
    service.register(indicator2);

    const result = await service.check();

    expect(result.status).toBe('up');
    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe('up');
    expect(result.results[1].status).toBe('up');
  });

  it('should return down status when any indicator is down', async () => {
    const indicator1: HealthIndicator = {
      check: vi.fn().mockResolvedValue({ name: 'indicator1', status: 'up' }),
    };
    const indicator2: HealthIndicator = {
      check: vi.fn().mockResolvedValue({
        name: 'indicator2',
        status: 'down',
        details: { error: 'Connection failed', message: 'Unable to connect to database' },
      }),
    };

    service.register(indicator1);
    service.register(indicator2);

    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.results).toHaveLength(2);
    expect(result.results[1].status).toBe('down');
    expect(result.results[1].details).toEqual({ error: 'Connection failed', message: 'Unable to connect to database' });
  });

  it('should return down status when indicator throws error', async () => {
    const indicator: HealthIndicator = {
      check: vi.fn().mockRejectedValue(new Error('Connection timeout')),
    };

    service.register(indicator);

    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe('down');
    expect(result.results[0].details?.error).toBe('Connection timeout');
    expect(result.results[0].details).toHaveProperty('error');
  });

  it('should return empty results when no indicators registered', async () => {
    const result = await service.check();

    expect(result.status).toBe('up');
    expect(result.results).toHaveLength(0);
  });

  it('should handle timeout for slow indicators', async () => {
    let didAbort = false;

    const slowIndicator: HealthIndicator = {
      check: vi.fn().mockImplementation(
        (signal?: AbortSignal) =>
          new Promise<HealthIndicatorResult>((resolve) => {
            signal?.addEventListener('abort', () => {
              didAbort = true;
            });

            setTimeout(() => resolve({ name: 'slow', status: 'up' }), 10000);
          })
      ),
    };

    const fastService = new HealthCheckService({ timeout: 100 });
    fastService.register(slowIndicator);

    const result = await fastService.check();

    expect(result.status).toBe('down');
    expect(result.results[0].status).toBe('down');
    expect(result.results[0].details?.error).toContain('timeout');
    expect(didAbort).toBe(true);
  });

  it('should use default timeout of 5000ms', () => {
    const defaultService = new HealthCheckService();
    expect(defaultService).toBeInstanceOf(HealthCheckService);
  });

  it('should include indicator name in timeout error', async () => {
    class CustomIndicator implements HealthIndicator {
      async check(_signal?: AbortSignal): Promise<HealthIndicatorResult> {
        return new Promise((resolve) => setTimeout(() => resolve({ name: 'custom', status: 'up' }), 10000));
      }
    }

    const fastService = new HealthCheckService({ timeout: 100 });
    fastService.register(new CustomIndicator());

    const result = await fastService.check();

    expect(result.results[0].details?.error).toContain('CustomIndicator');
  });

  it('should support typed success details', async () => {
    const indicator: HealthIndicator = {
      check: vi.fn().mockResolvedValue({
        name: 'database',
        status: 'up',
        details: { latency: 15, connections: 5 },
      }),
    };

    service.register(indicator);

    const result = await service.check();

    expect(result.status).toBe('up');
    if (result.results[0].details && 'latency' in result.results[0].details) {
      expect(result.results[0].details.latency).toBe(15);
      expect(result.results[0].details.connections).toBe(5);
    }
  });

  it('should support typed error details with code', async () => {
    const indicator: HealthIndicator = {
      check: vi.fn().mockResolvedValue({
        name: 'api',
        status: 'down',
        details: { error: 'Service unavailable', code: '503', message: 'API rate limit exceeded' },
      }),
    };

    service.register(indicator);

    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.results[0].details?.error).toBe('Service unavailable');
    expect(result.results[0].details?.code).toBe('503');
    expect(result.results[0].details?.message).toBe('API rate limit exceeded');
  });

  it('should handle non-Error objects in error details', async () => {
    const indicator: HealthIndicator = {
      check: vi.fn().mockRejectedValue('String error message'),
    };

    service.register(indicator);

    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.results[0].details?.error).toBe('String error message');
  });

  it('should handle null error objects', async () => {
    const indicator: HealthIndicator = {
      check: vi.fn().mockRejectedValue(null),
    };

    service.register(indicator);

    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.results[0].details?.error).toBe('null');
  });

  it('should clear timeout when indicator completes quickly', async () => {
    const fastIndicator: HealthIndicator = {
      check: vi.fn().mockResolvedValue({
        name: 'fast',
        status: 'up',
        details: { responseTime: 1 },
      }),
    };

    const fastService = new HealthCheckService({ timeout: 5000 });
    fastService.register(fastIndicator);

    const result = await fastService.check();

    expect(result.status).toBe('up');
    expect(result.results[0].status).toBe('up');
  });
});
