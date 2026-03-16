import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type TxAdapter, TxManager } from '../index';

type TestClient = {
  id: string;
};

function createObservedAdapter(events: string[]): TxAdapter<TestClient> {
  return {
    transaction: vi.fn(async (fn) => {
      events.push('transaction:start');
      const result = await fn({ id: 'root-client' });
      events.push('transaction:commit');
      return result;
    }),
    savepoint: vi.fn(async (_client, fn) => {
      events.push('savepoint:start');
      const result = await fn({ id: 'nested-client' });
      events.push('savepoint:release');
      return result;
    }),
    supportsSavepoint: () => true,
  };
}

describe('TxManager characterization', () => {
  beforeEach(() => {
    Container.reset();
  });

  it('should preserve root transaction execution behavior', async () => {
    const events: string[] = [];
    const txManager = new TxManager(createObservedAdapter(events));

    const result = await txManager.run(async () => {
      events.push(`fn:${txManager.getClient()?.id}`);
      return 'root-result';
    });

    expect(result).toBe('root-result');
    expect(events).toEqual(['transaction:start', 'fn:root-client', 'transaction:commit']);
    expect(txManager.getClient()).toBeNull();
  });

  it('should preserve nested savepoint execution behavior', async () => {
    const events: string[] = [];
    const txManager = new TxManager(createObservedAdapter(events), { defaultNesting: 'savepoint' });

    await txManager.run(async () => {
      events.push(`outer:${txManager.getClient()?.id}`);

      await txManager.run(async () => {
        events.push(`inner:${txManager.getClient()?.id}`);
      });

      events.push(`after-inner:${txManager.getClient()?.id}`);
    });

    expect(events).toEqual([
      'transaction:start',
      'outer:root-client',
      'savepoint:start',
      'inner:nested-client',
      'savepoint:release',
      'after-inner:root-client',
      'transaction:commit',
    ]);
  });

  it('should preserve after-commit hook timing and context', async () => {
    const events: string[] = [];
    const txManager = new TxManager(createObservedAdapter(events));

    await txManager.run(async () => {
      events.push('fn');
      txManager.onAfterCommit(() => {
        events.push(`hook:${txManager.getClient()?.id}`);
      });
    });

    expect(events).toEqual(['transaction:start', 'fn', 'transaction:commit', 'hook:root-client']);
    expect(txManager.getClient()).toBeNull();
  });

  it('should preserve context setup and teardown across nested runs', async () => {
    const events: string[] = [];
    const txManager = new TxManager(createObservedAdapter(events), { defaultNesting: 'savepoint' });

    events.push(`outside:${txManager.getClient()}`);

    await txManager.run(async () => {
      events.push(`root:${txManager.getClient()?.id}`);

      await txManager.run(async () => {
        events.push(`nested:${txManager.getClient()?.id}`);
      });

      events.push(`resumed:${txManager.getClient()?.id}`);
    });

    events.push(`after:${txManager.getClient()}`);

    expect(events).toEqual([
      'outside:null',
      'transaction:start',
      'root:root-client',
      'savepoint:start',
      'nested:nested-client',
      'savepoint:release',
      'resumed:root-client',
      'transaction:commit',
      'after:null',
    ]);
  });
});
