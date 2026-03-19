import { registerBatchLoaderFactory } from '@croco/dataloader-core';
import { Container, Context } from '@croco/framework-context';
import { BatchLoad } from '@croco/repository-core';
import { Transactional, type TxAdapter, TxManager, TxManagerRegistry } from '@croco/tx-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AbstractDrizzleRepository } from '../libs/AbstractDrizzleRepository';
import type { DrizzleDb } from '../libs/types';

type UserEntity = {
  id: string;
  txId: string;
};

type TxClient = {
  txId: string;
};

type MockDb = DrizzleDb<TxClient> & {
  name: string;
};

class IntegrationRepository extends AbstractDrizzleRepository<UserEntity, string, MockDb> {
  readonly batchCalls: Array<{ ids: string[]; txId: string }> = [];

  @BatchLoad({ by: 'id' })
  async findById(id: string): Promise<UserEntity | null> {
    return { id, txId: this.getClientId() };
  }

  async findByIds(ids: string[]): Promise<UserEntity[]> {
    const txId = this.getClientId();
    this.batchCalls.push({ ids: [...ids], txId });

    return ids.map((id) => ({ id, txId }));
  }

  async save(entity: UserEntity): Promise<UserEntity> {
    return entity;
  }

  async delete(_id: string): Promise<void> {
    return;
  }

  private getClientId(): string {
    const dbOrTx = this.getDb();
    if ('txId' in dbOrTx && typeof dbOrTx.txId === 'string') {
      return dbOrTx.txId;
    }

    return 'root';
  }
}

class IntegrationService {
  constructor(private readonly repository: IntegrationRepository) {}

  @Transactional()
  async loadUsers(ids: string[]): Promise<Array<UserEntity | null>> {
    return Promise.all(ids.map((id) => this.repository.findById(id)));
  }
}

describe('Repository + BatchLoad + Transaction integration', () => {
  let adapter!: TxAdapter<TxClient>;
  let repository!: IntegrationRepository;
  let service!: IntegrationService;

  beforeEach(() => {
    Container.reset();
    TxManagerRegistry.clear();
    registerBatchLoaderFactory();

    let txCounter = 0;
    const transaction = async <T>(fn: (client: TxClient) => Promise<T>): Promise<T> => {
      txCounter += 1;
      return fn({ txId: `tx-${txCounter}` });
    };
    const savepoint = async <T>(client: TxClient, fn: (nested: TxClient) => Promise<T>): Promise<T> => fn(client);

    adapter = {
      transaction: vi.fn(transaction) as typeof transaction,
      savepoint: vi.fn(savepoint) as typeof savepoint,
      supportsSavepoint: () => true,
    };

    const txManager = new TxManager(adapter);
    TxManagerRegistry.register(txManager);

    const dbTransaction = async <T>(fn: (client: TxClient) => Promise<T>): Promise<T> => fn({ txId: 'db-client' });

    const db: MockDb = {
      name: 'db',
      transaction: vi.fn(dbTransaction) as typeof dbTransaction,
    };

    repository = new IntegrationRepository(db, txManager);
    service = new IntegrationService(repository);
  });

  afterEach(() => {
    Container.reset();
  });

  it('should batch concurrent calls through transactional chain', async () => {
    await Context.run({ requestId: 'integration-1' }, async () => {
      const [first, second, third] = await service.loadUsers(['1', '2', '1']);

      expect(first).toEqual({ id: '1', txId: 'tx-1' });
      expect(second).toEqual({ id: '2', txId: 'tx-1' });
      expect(third).toEqual({ id: '1', txId: 'tx-1' });
    });

    expect(repository.batchCalls).toHaveLength(1);
    expect(repository.batchCalls[0]).toEqual({
      ids: ['1', '2'],
      txId: 'tx-1',
    });

    expect(adapter.transaction).toHaveBeenCalledTimes(1);
  });

  it('should isolate cache across transaction contexts', async () => {
    await Context.run({ requestId: 'integration-2-a' }, async () => {
      const [user] = await service.loadUsers(['same-key']);
      expect(user).toEqual({ id: 'same-key', txId: 'tx-1' });
    });

    await Context.run({ requestId: 'integration-2-b' }, async () => {
      const [user] = await service.loadUsers(['same-key']);
      expect(user).toEqual({ id: 'same-key', txId: 'tx-2' });
    });

    expect(repository.batchCalls).toHaveLength(2);
    expect(repository.batchCalls.map((call) => call.txId)).toEqual(['tx-1', 'tx-2']);
  });
});
