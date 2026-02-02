import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import type { OnboardingState } from '@croco/onboarding-core';
import { type DrizzleDb, TxManager } from '@croco/tx-drizzle';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRIZZLE_TOKEN, DrizzleOnboardingStore } from '../libs/DrizzleOnboardingStore';

describe('DrizzleOnboardingStore', () => {
  let store: DrizzleOnboardingStore;
  let mockDb: any;
  let mockTxManager: any;

  beforeEach(() => {
    Container.reset();

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

    Container.set(DRIZZLE_TOKEN, mockDb);
    Container.set(TxManager, mockTxManager);

    store = new DrizzleOnboardingStore(mockDb as DrizzleDb, mockTxManager as TxManager<DrizzleDb>);
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
