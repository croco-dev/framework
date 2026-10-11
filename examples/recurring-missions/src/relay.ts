import "reflect-metadata";
import { DefaultEventSerializer } from "@croco/events-core";
import { TransactionalOutboxRelay } from "@croco/events-tx";
import { MissionInvalidProblem } from "@croco/gamification-core";
import { MissionCompletedDomainEvent } from "@croco/gamification-drizzle";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { missionOutbox } from "./outbox";
import type { DrizzleMissionClient } from "@croco/gamification-drizzle";

async function main(): Promise<void> {
  const connectionString = process.env.GAMIFICATION_POSTGRES_URL;
  if (!connectionString) throw new MissionInvalidProblem("GAMIFICATION_POSTGRES_URL is required");
  const pool = new Pool({ connectionString });
  try {
    const db = drizzle(pool) as unknown as DrizzleMissionClient;
    const txManager = new TxManager(createDrizzleTxAdapter(db));
    const serializer = new DefaultEventSerializer();
    const relay = new TransactionalOutboxRelay({
      store: missionOutbox(db, txManager).store,
      batchSize: 100,
      publish: async (message) => {
        const event = serializer.deserialize({
          eventId: message.eventId,
          eventType: message.eventType,
          occurredAt: message.occurredAt.toISOString(),
          payload: message.payload,
        });
        if (!(event instanceof MissionCompletedDomainEvent))
          throw new MissionInvalidProblem("Unexpected event");
        process.stdout.write(
          `${event.eventId} ${event.key.missionId} v${event.key.version}: completed\n`,
        );
      },
    });
    const result = await relay.publishBatch();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
}
void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
