import type { Repository } from '@croco/repository-core';
import type { TxManager } from '@croco/tx-core';
import type { DrizzleDb, InferTxClient } from './types';

export abstract class AbstractDrizzleRepository<TEntity, TId, TDb extends DrizzleDb<any> = DrizzleDb>
  implements Repository<TEntity, TId>
{
  constructor(
    protected readonly db: TDb,
    protected readonly txManager: TxManager<InferTxClient<TDb>>
  ) {}

  protected getDb(): TDb | InferTxClient<TDb> {
    return this.txManager.getClient() ?? this.db;
  }

  abstract findById(id: TId): Promise<TEntity | null>;
  abstract findByIds(ids: TId[]): Promise<TEntity[]>;
  abstract save(entity: TEntity): Promise<TEntity>;
  abstract delete(id: TId): Promise<void>;
}
