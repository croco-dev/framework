import { DrizzleTransactionalEventStore, TransactionalOutbox } from "@croco/events-tx";
import type { DrizzleTransactionalEventStoreDb, TransactionalEventStore } from "@croco/events-tx";
import type { DrizzleMissionClient } from "@croco/gamification-drizzle";
import type { TxManager } from "@croco/tx-core";

export function missionOutbox(
  db: DrizzleMissionClient,
  txManager: TxManager<DrizzleMissionClient>,
) {
  const store = new DrizzleTransactionalEventStore({
    db: db as unknown as DrizzleTransactionalEventStoreDb,
    txManager: txManager as unknown as TxManager<DrizzleTransactionalEventStoreDb>,
  }) as unknown as TransactionalEventStore<DrizzleMissionClient>;
  return { store, outbox: new TransactionalOutbox({ store, txManager }) };
}
