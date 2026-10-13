import {
  emptyResearchRecord,
  researchIdentity,
  ResearchPersistenceProblem,
} from "@croco/research-core";
import { Problem } from "@croco/problems-core";
import { eq } from "drizzle-orm";
import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ResearchRecord, ResearchScope, ResearchStore } from "@croco/research-core";

/** One bounded aggregate owns study, candidate, consent, invitation, note and audit state atomically. */
export const researchStudies = pgTable("research_studies", {
  identity: text("identity").primaryKey(),
  record: jsonb("record").$type<ResearchRecord>().notNull(),
});
export type DrizzleResearchClient = NodePgDatabase<{ researchStudies: typeof researchStudies }>;
export class DrizzleResearchStore implements ResearchStore {
  constructor(private readonly db: DrizzleResearchClient) {}
  async read(scope: ResearchScope, id: string): Promise<ResearchRecord> {
    const identity = researchIdentity(scope, id);
    try {
      const rows = await this.db
        .select()
        .from(researchStudies)
        .where(eq(researchStudies.identity, identity))
        .limit(1);
      return structuredClone(rows[0]?.record ?? emptyResearchRecord());
    } catch (error) {
      if (error instanceof Problem) throw error;
      throw new ResearchPersistenceProblem();
    }
  }
  async transact<T>(
    scope: ResearchScope,
    id: string,
    operation: (record: ResearchRecord) => Promise<T>,
  ): Promise<T> {
    const identity = researchIdentity(scope, id);
    try {
      return await this.db.transaction(async (tx) => {
        await tx
          .insert(researchStudies)
          .values({ identity, record: emptyResearchRecord() })
          .onConflictDoNothing();
        const rows = await tx
          .select()
          .from(researchStudies)
          .where(eq(researchStudies.identity, identity))
          .for("update");
        const row = rows[0];
        if (!row) throw new ResearchPersistenceProblem();
        const record = structuredClone(row.record);
        const result = structuredClone(await operation(record));
        await tx
          .update(researchStudies)
          .set({ record })
          .where(eq(researchStudies.identity, identity));
        return result;
      });
    } catch (error) {
      if (error instanceof Problem) throw error;
      throw new ResearchPersistenceProblem();
    }
  }
}
