import { EtlEventProblem } from "./EtlEventProblem";
import type { QuarantineRecord, QuarantineStore } from "./AnalyticsOutboxConsumer";

export interface QuarantinePostgresClient {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export interface QuarantinePostgresConnection extends QuarantinePostgresClient {
  release(error?: Error | boolean): void;
}

export interface QuarantinePostgresPool extends QuarantinePostgresClient {
  connect(): Promise<QuarantinePostgresConnection>;
}

/** Install only the analytics quarantine ledger; this never changes the shared outbox. */
export async function installPostgresQuarantineSchema(db: QuarantinePostgresClient): Promise<void> {
  await db.query(`
CREATE TABLE IF NOT EXISTS etl_event_quarantine (
  consumer_id TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  outbox_message_id TEXT NOT NULL,
  event_id TEXT,
  code TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (consumer_id, source_ref, outbox_message_id)
);
`);
}

export class PostgresQuarantineStore implements QuarantineStore {
  constructor(private readonly pool: QuarantinePostgresPool) {}

  async record(input: QuarantineRecord): Promise<"recorded" | "duplicate"> {
    const db = await this.pool.connect();
    let committing = false;
    let committed = false;
    try {
      await db.query("BEGIN");
      const inserted = await db.query(
        `INSERT INTO etl_event_quarantine (consumer_id,source_ref,outbox_message_id,event_id,code)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (consumer_id,source_ref,outbox_message_id) DO NOTHING`,
        [input.consumerId, input.sourceRef, input.outboxMessageId, input.eventId, input.code],
      );
      const stored = await db.query<{ event_id: string | null; code: string }>(
        `SELECT event_id,code FROM etl_event_quarantine
         WHERE consumer_id=$1 AND source_ref=$2 AND outbox_message_id=$3`,
        [input.consumerId, input.sourceRef, input.outboxMessageId],
      );
      if (
        stored.rows.length !== 1 ||
        stored.rows[0].event_id !== input.eventId ||
        stored.rows[0].code !== input.code
      ) {
        throw new EtlEventProblem("etl-events-tx/quarantine-conflict");
      }
      committing = true;
      await db.query("COMMIT");
      committed = true;
      return inserted.rowCount === 1 ? "recorded" : "duplicate";
    } catch (error) {
      if (!committing) await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release(committing && !committed ? true : undefined);
    }
  }
}
