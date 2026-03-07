import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validateConfig } from '../../../framework-config/src';
import type { HealthIndicator } from '../../../health-core/src';
import { HealthCheckService } from '../../../health-core/src';
import { ShutdownManager } from '../libs/ShutdownManager';

type ShutdownManagerStatic = {
  instance: ShutdownManager | undefined;
};

describe('application lifecycle integration', () => {
  afterEach(() => {
    ShutdownManager.reset();
    (ShutdownManager as unknown as ShutdownManagerStatic).instance = undefined;
  });

  it('should run Config -> Start -> Health -> Shutdown flow without errors', async () => {
    const env = {
      APP_NAME: 'croco',
      PORT: '3000',
    };

    const config = validateConfig(
      z.object({
        APP_NAME: z.string(),
        PORT: z.coerce.number(),
      }),
      env
    );

    expect(config).toEqual({ APP_NAME: 'croco', PORT: 3000 });

    const manager = ShutdownManager.getInstance();
    const processOnSpy = vi.spyOn(process, 'on');

    manager.listen();

    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

    const healthCheckService = new HealthCheckService();
    const indicator: HealthIndicator = {
      check: vi.fn(async () => ({
        name: 'startup',
        status: 'up' as const,
      })),
    };
    healthCheckService.register(indicator);

    const health = await healthCheckService.check();
    expect(health.status).toBe('up');
    expect(health.results).toEqual([{ name: 'startup', status: 'up' }]);

    const shutdownHook = {
      onShutdown: vi.fn(async () => {}),
    };
    manager.register(shutdownHook);

    await manager.shutdown();

    expect(shutdownHook.onShutdown).toHaveBeenCalledTimes(1);

    processOnSpy.mockRestore();
  });

  it('should execute shutdown hooks in sequence when SIGTERM is emitted', async () => {
    const manager = ShutdownManager.getInstance();
    const order: string[] = [];

    manager.register({
      onShutdown: async () => {
        order.push('first');
      },
    });

    manager.register({
      onShutdown: async () => {
        order.push('second');
      },
    });

    manager.listen();

    process.emit('SIGTERM');
    await vi.waitFor(() => {
      expect(order).toEqual(['second', 'first']);
    });
  });
});
