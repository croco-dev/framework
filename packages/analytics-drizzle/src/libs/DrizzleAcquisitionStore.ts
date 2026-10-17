import { factScopeKey } from "@croco/analytics-core";
import { sql } from "drizzle-orm";
import { Problem } from "@croco/problems-core";
import { AcquisitionProblem, emptyAcquisitionState } from "@croco/analytics-core/acquisition";
import type {
  AcquisitionScope,
  AcquisitionState,
  AcquisitionStore,
} from "@croco/analytics-core/acquisition";
import type { FactHistoryDatabase } from "./DrizzleFactHistoryStore";

/** PostgreSQL scope lock serializes receipts, identity links, definitions and erasure.
 * This bounded store supports at most 10,000 records per scope; overflow fails explicitly.
 * Large installations should shard application scopes or implement the same store contract.
 */
export class DrizzleAcquisitionStore implements AcquisitionStore {
  constructor(private readonly db: FactHistoryDatabase) {}
  async transact<T>(
    scope: AcquisitionScope,
    operation: (state: AcquisitionState) => T,
  ): Promise<T> {
    try {
      return await this.db.transaction(async (tx) => {
        const key = factScopeKey(scope);
        await tx.execute(
          sql`INSERT INTO analytics_acquisition_scopes(scope_key) VALUES(${key}) ON CONFLICT DO NOTHING`,
        );
        const revision = await tx.execute(
          sql`SELECT revision FROM analytics_acquisition_scopes WHERE scope_key=${key} FOR UPDATE`,
        );
        const records = await tx.execute(
          sql`SELECT kind, row_data FROM analytics_acquisition_records WHERE scope_key=${key} ORDER BY kind, record_key LIMIT 10001`,
        );
        if (records.rows.length > 10000) throw new AcquisitionProblem("limit");
        const state = emptyAcquisitionState();
        state.revision = Number(revision.rows[0].revision);
        for (const record of records.rows) {
          const kind = record.kind as Exclude<keyof AcquisitionState, "revision">;
          (state[kind] as unknown[]).push(record.row_data);
        }
        // Definitions are selected by revision, not lexical record key order.
        state.definitions.sort((a, b) => a.revision - b.revision);
        const original = JSON.stringify(state);
        const result = operation(state);
        const count =
          state.touchpoints.length +
          state.links.length +
          state.definitions.length +
          state.reports.length +
          state.deleted.length;
        if (count > 10000) throw new AcquisitionProblem("limit");
        if (JSON.stringify(state) !== original) {
          await tx.execute(sql`DELETE FROM analytics_acquisition_records WHERE scope_key=${key}`);
          for (const kind of [
            "touchpoints",
            "links",
            "definitions",
            "reports",
            "deleted",
          ] as const) {
            for (const row of state[kind]) {
              let source = "";
              let recordKey: string;
              if (kind === "touchpoints") {
                const point = row as AcquisitionState["touchpoints"][number];
                source = point.source;
                recordKey = point.id;
              } else if (kind === "definitions") {
                const definition = row as AcquisitionState["definitions"][number];
                recordKey = JSON.stringify([definition.id, definition.revision]);
              } else if (kind === "deleted") {
                const subject = row as AcquisitionState["deleted"][number];
                recordKey = JSON.stringify([subject.kind, subject.ref]);
              } else recordKey = (row as { id: string }).id;
              await tx.execute(sql`INSERT INTO analytics_acquisition_records(scope_key,kind,source,record_key,row_data)
                VALUES(${key},${kind},${source},${recordKey},${JSON.stringify(row)}::jsonb)`);
            }
          }
          await tx.execute(
            sql`UPDATE analytics_acquisition_scopes SET revision=${state.revision} WHERE scope_key=${key}`,
          );
        }
        return structuredClone(result);
      });
    } catch (cause) {
      if (cause instanceof Problem) throw cause;
      const problem = new AcquisitionProblem("persistence");
      Object.defineProperty(problem, "cause", { value: cause });
      throw problem;
    }
  }
}
