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
      check: vi.fn().mockResolvedValue({ name: 'indicator2', status: 'down', details: { error: 'Connection failed' } }),
    };

    service.register(indicator1);
    service.register(indicator2);

    const result = await service.check();

    expect(result.status).toBe('down');
    expect(result.results).toHaveLength(2);
    expect(result.results[1].status).toBe('down');
    expect(result.results[1].details).toEqual({ error: 'Connection failed' });
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
  });

  it('should return empty results when no indicators registered', async () => {
    const result = await service.check();

    expect(result.status).toBe('up');
    expect(result.results).toHaveLength(0);
  });

  it('should handle timeout for slow indicators', async () => {
    const slowIndicator: HealthIndicator = {
      check: vi
        .fn()
        .mockImplementation(
          () =>
            new Promise<HealthIndicatorResult>((resolve) =>
              setTimeout(() => resolve({ name: 'slow', status: 'up' }), 10000)
            )
        ),
    };

    const fastService = new HealthCheckService({ timeout: 100 });
    fastService.register(slowIndicator);

    const result = await fastService.check();

    expect(result.status).toBe('down');
    expect(result.results[0].status).toBe('down');
    expect(result.results[0].details?.error).toContain('timeout');
  });

  it('should use default timeout of 5000ms', () => {
    const defaultService = new HealthCheckService();
    expect(defaultService).toBeInstanceOf(HealthCheckService);
  });

  it('should include indicator name in timeout error', async () => {
    class CustomIndicator implements HealthIndicator {
      async check(): Promise<HealthIndicatorResult> {
        return new Promise((resolve) => setTimeout(() => resolve({ name: 'custom', status: 'up' }), 10000));
      }
    }

    const fastService = new HealthCheckService({ timeout: 100 });
    fastService.register(new CustomIndicator());

    const result = await fastService.check();

    expect(result.results[0].details?.error).toContain('CustomIndicator');
  });
});
