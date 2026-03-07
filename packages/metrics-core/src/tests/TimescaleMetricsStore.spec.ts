import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MRRMovement } from '../../src/types';
import { type PostgresClient, TimescaleMetricsStore } from '../libs/stores/TimescaleMetricsStore';

describe('TimescaleMetricsStore', () => {
  let db!: PostgresClient;
  let store!: TimescaleMetricsStore;

  const movement: MRRMovement = {
    new: { amount: 1000, currency: 'USD' },
    expansion: { amount: 0, currency: 'USD' },
    contraction: { amount: 0, currency: 'USD' },
    churned: { amount: 0, currency: 'USD' },
    reactivation: { amount: 0, currency: 'USD' },
    net: { amount: 1000, currency: 'USD' },
  };

  beforeEach(() => {
    db = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    store = new TimescaleMetricsStore(db);
  });

  it('should use conflict-safe insert when event key is provided', async () => {
    await store.recordMRRMovement('tenant-1', movement, new Date('2026-03-02T00:00:00.000Z'), 'event-key-1');

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = vi.mocked(db.query).mock.calls[0] ?? [];

    expect(sql).toContain('event_key');
    expect(sql).toContain('ON CONFLICT (tenant_id, event_key) DO NOTHING');
    expect(params).toEqual([
      'tenant-1',
      'event-key-1',
      new Date('2026-03-02T00:00:00.000Z'),
      1000,
      'USD',
      0,
      'USD',
      0,
      'USD',
      0,
      'USD',
      0,
      'USD',
      1000,
      'USD',
    ]);
  });

  it('should keep legacy insert path when event key is omitted', async () => {
    await store.recordMRRMovement('tenant-1', movement, new Date('2026-03-02T00:00:00.000Z'));

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = vi.mocked(db.query).mock.calls[0] ?? [];

    expect(sql).not.toContain('event_key');
    expect(sql).not.toContain('ON CONFLICT');
    expect(params).toEqual([
      'tenant-1',
      new Date('2026-03-02T00:00:00.000Z'),
      1000,
      'USD',
      0,
      'USD',
      0,
      'USD',
      0,
      'USD',
      0,
      'USD',
      1000,
      'USD',
    ]);
  });
});
