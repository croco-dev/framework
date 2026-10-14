import { createHash, randomBytes } from "node:crypto";
import { SurveyUnavailableProblem } from "@croco/research-core";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type {
  SurveyRecord,
  SurveyScope,
  SurveySession,
  SurveyStore,
  SurveyTokenCodec,
  SurveyPublication,
  SurveyResponse,
} from "@croco/research-core";

export const surveyTokenCodec: SurveyTokenCodec = {
  create() {
    const raw = randomBytes(32).toString("base64url");
    return { raw, hash: this.hash(raw) };
  },
  hash(raw) {
    return createHash("sha256").update(raw).digest("hex");
  },
};
export type DrizzleSurveyClient = NodePgDatabase<Record<string, never>>;

/** The scope lock orders all survey mutations, including frequency claims across versions. */
export class DrizzleSurveyStore implements SurveyStore {
  constructor(private readonly db: DrizzleSurveyClient) {}
  async transaction<T>(
    scope: SurveyScope,
    callback: (session: SurveySession) => Promise<T>,
  ): Promise<T> {
    return this.db
      .transaction(async (tx) => {
        const scopeKey = JSON.stringify([scope.tenantId, scope.appId, scope.environmentId]);
        await execute(sql`select pg_advisory_xact_lock(hashtextextended(${scopeKey}, 0))`);
        const where = sql`tenant_id=${scope.tenantId} and app_id=${scope.appId} and environment_id=${scope.environmentId}`;
        async function execute(statement: SQL) {
          try {
            return await tx.execute(statement);
          } catch {
            throw new SurveyUnavailableProblem();
          }
        }
        async function rows(statement: SQL): Promise<Record<string, unknown>[]> {
          const result = await execute(statement);
          return result.rows;
        }
        return callback({
          async get(kind, id) {
            const found = await rows(
              sql`select kind,id,family_id,payload from research_records where ${where} and kind=${kind} and id=${id} limit 1`,
            );
            const row = found[0];
            return row
              ? ({
                  kind: row.kind,
                  id: row.id,
                  familyId: row.family_id,
                  value: row.payload,
                } as SurveyRecord)
              : null;
          },
          async put(record) {
            await execute(sql`insert into research_records(tenant_id,app_id,environment_id,kind,id,family_id,payload)
            values(${scope.tenantId},${scope.appId},${scope.environmentId},${record.kind},${record.id},${record.familyId},${JSON.stringify(record.value)}::jsonb)
            on conflict(tenant_id,app_id,environment_id,kind,id) do update set payload=excluded.payload`);
          },
          async eraseAnswers(invitationId, at) {
            await execute(
              sql`update research_records set payload=(payload - 'classification') || jsonb_build_object('answers','{}'::jsonb,'deletedAt',${at}::text) where ${where} and kind='response' and payload->>'invitationId'=${invitationId}`,
            );
          },
          async latest(familyId) {
            const found = await rows(
              sql`select payload from research_records where ${where} and kind='definition' and family_id=${familyId} order by (payload->>'revision')::bigint desc limit 1`,
            );
            return (found[0]?.payload as SurveyPublication) ?? null;
          },
          async invitations(familyId, subject, since) {
            const found = await rows(
              sql`select count(*)::int as count from research_records where ${where} and kind='invitation' and family_id=${familyId} and payload->'subject'->>'kind'=${subject.kind} and payload->'subject'->>'id'=${subject.id} and (payload->>'createdAt')::timestamptz >= ${since}::timestamptz`,
            );
            return Number(found[0]?.count ?? 0);
          },
          async counts(familyId) {
            const found = await rows(
              sql`select count(*)::int as invitations, count(*) filter(where payload ? 'shownAt')::int as exposures, count(*) filter(where payload ? 'dismissedAt')::int as dismissed, count(*) filter(where payload ? 'submittedAt')::int as submitted from research_records where ${where} and kind='invitation' and family_id=${familyId}`,
            );
            const row = found[0];
            return {
              invitations: Number(row?.invitations ?? 0),
              exposures: Number(row?.exposures ?? 0),
              dismissed: Number(row?.dismissed ?? 0),
              submitted: Number(row?.submitted ?? 0),
            };
          },
          async responses(familyId, after, limit) {
            const found = await rows(
              sql`select payload from research_records where ${where} and kind='response' and family_id=${familyId} and id=payload->>'invitationId' and id>${after} order by id collate "C" limit ${limit}`,
            );
            return found.map((r) => r.payload as SurveyResponse);
          },
        });
      })
      .catch((error: unknown) => {
        // Business Problems survive rollback; infrastructure faults remain explicit.
        if (
          error instanceof SurveyUnavailableProblem ||
          (error &&
            typeof error === "object" &&
            "code" in error &&
            typeof error.code === "string" &&
            error.code.startsWith("research/"))
        )
          throw error;
        throw new SurveyUnavailableProblem();
      });
  }
}
