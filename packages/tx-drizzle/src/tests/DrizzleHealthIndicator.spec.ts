import { describe, expect, it, vi } from 'vitest';
import { DrizzleHealthIndicator } from '../libs/DrizzleHealthIndicator';

describe('DrizzleHealthIndicator', () => {
  it('should return up when transaction query succeeds', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const db = {
      transaction: vi.fn(async (callback: (tx: { execute: typeof execute }) => Promise<void>) => {
        await callback({ execute });
      }),
    };

    const indicator = new DrizzleHealthIndicator(db as never, { name: 'primary-db' });

    await expect(indicator.check()).resolves.toEqual({
      name: 'primary-db',
      status: 'up',
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('should return down with error details when transaction fails', async () => {
    const db = {
      transaction: vi.fn().mockRejectedValue(new Error('database down')),
    };

    const indicator = new DrizzleHealthIndicator(db as never);

    await expect(indicator.check()).resolves.toEqual({
      name: 'database',
      status: 'down',
      details: { error: 'database down' },
    });
  });
});
