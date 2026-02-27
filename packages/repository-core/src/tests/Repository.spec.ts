import type { TxManager } from '@croco/tx-core';
import type { DrizzleDb } from '@croco/tx-drizzle';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AbstractDrizzleRepository } from '../libs/AbstractDrizzleRepository';

type TestEntity = { id: string; name: string };
type TestId = string;

interface MockDb extends DrizzleDb<any> {
  select: () => any;
  txId?: string;
}

class TestRepository extends AbstractDrizzleRepository<TestEntity, TestId, MockDb> {
  public getDbPublic() {
    return this.getDb();
  }

  async findById(id: TestId): Promise<TestEntity | null> {
    return null;
  }

  async findByIds(ids: TestId[]): Promise<TestEntity[]> {
    return [];
  }

  async save(entity: TestEntity): Promise<TestEntity> {
    return entity;
  }

  async delete(id: TestId): Promise<void> {
    return;
  }
}

describe('AbstractDrizzleRepository', () => {
  let repository!: TestRepository;
  let mockDb!: MockDb;
  let mockTxManager!: TxManager<MockDb>;

  beforeEach(() => {
    mockDb = {
      transaction: vi.fn(),
      select: vi.fn(),
    } as unknown as MockDb;

    mockTxManager = {
      getClient: vi.fn(),
      run: vi.fn(),
      isInTransaction: vi.fn(),
    } as unknown as TxManager<MockDb>;

    repository = new TestRepository(mockDb, mockTxManager);
  });

  it('should use default db when no transaction is active', () => {
    vi.mocked(mockTxManager.getClient).mockReturnValue(null);

    const db = repository.getDbPublic();
    expect(db).toBe(mockDb);
  });

  it('should use tx client when transaction is active', () => {
    const mockTxClient = { ...mockDb, txId: 'tx1' } as MockDb;
    vi.mocked(mockTxManager.getClient).mockReturnValue(mockTxClient);

    const db = repository.getDbPublic();
    expect(db).toBe(mockTxClient);
    expect(db.txId).toBe('tx1');
  });
});
