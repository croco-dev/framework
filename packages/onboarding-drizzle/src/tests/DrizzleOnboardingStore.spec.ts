import 'reflect-metadata';
import type { OnboardingState } from '@croco/onboarding-core';
import type { TxManager } from '@croco/tx-core';
import type { DrizzleDb } from '@croco/tx-drizzle';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DrizzleOnboardingStore } from '../libs/DrizzleOnboardingStore';

describe('DrizzleOnboardingStore', () => {
  let store!: DrizzleOnboardingStore;
  let mockDb!: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
  };
  let mockTxManager!: {
    getClient: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Mock Drizzle DB chain
    // select().from().where().limit()
    const mockQueryBuilder = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // Default empty
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      select: vi.fn().mockReturnValue(mockQueryBuilder),
      insert: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockTxManager = {
      getClient: vi.fn().mockReturnValue(null), // No active tx
    };

    store = new DrizzleOnboardingStore(
      mockDb as unknown as DrizzleDb & {
        select: (...args: unknown[]) => unknown;
        insert: (...args: unknown[]) => unknown;
      },
      mockTxManager as unknown as TxManager<
        DrizzleDb & {
          select: (...args: unknown[]) => unknown;
          insert: (...args: unknown[]) => unknown;
        }
      >
    );
  });

  it('should return null when state not found', async () => {
    const state = await store.getState('tenant-1', 'user-1', 'onboarding-1');
    expect(state).toBeNull();
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should save state using insert on conflict', async () => {
    const newState: OnboardingState = {
      steps: { 'step-1': { completed: true } },
      isCompleted: false,
      completedAt: undefined,
    };

    await store.saveState('tenant-1', 'user-1', 'onboarding-1', newState);

    expect(mockDb.insert).toHaveBeenCalled();
    // Verify values passed to insert... (omitted for brevity in mock test)
  });
});
