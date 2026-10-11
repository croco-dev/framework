import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { sql } from "drizzle-orm";
import {
  CohortInvalidProblem,
  PublishedCohortReader,
  cohortContentHash,
  cohortTimestamp,
  evaluateCohort,
  validateCohort,
} from "@croco/cohort-core";
import { compileCohortPredicate, identifier, sourceScope } from "./compiler";
import type { SQL } from "drizzle-orm";
import type {
  CohortPrivacyReader,
  CohortPredicate,
  CohortDefinition,
  CohortMember,
  CohortPublication,
  CohortPublicationStore,
  CohortRegistration,
  CohortRun,
  CohortScope,
  CohortSnapshot,
  CohortSubject,
  CohortValidationContext,
} from "@croco/cohort-core";
import type { CohortSourceMapping } from "./compiler";

export interface CohortPgExecutor {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}
export interface CohortPgDatabase extends CohortPgExecutor {
  transaction<T>(work: (tx: CohortPgExecutor) => Promise<T>): Promise<T>;
}
type StoredRun = {
  definition: CohortDefinition;
  run: CohortRun;
  fingerprint: string;
  checkpoint: string | null;
  revision: number;
  status: string;
};
const scopeKey = (scope: CohortScope): string =>
  JSON.stringify([scope.appId, scope.environment, scope.tenantId]);
const json = (value: unknown): SQL => sql`${JSON.stringify(value)}::jsonb`;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CohortInvalidProblem(message);
}
export type CohortMaterialization = Readonly<{
  definition: CohortDefinition;
  registration: CohortRegistration;
  context: CohortValidationContext;
  mapping: CohortSourceMapping;
  snapshotId: string;
}>;

/** PostgreSQL adapter; supports the execute/transaction surface of Drizzle's node-postgres driver. */
export class PostgresCohortStore implements CohortPublicationStore {
  constructor(private readonly database: CohortPgDatabase) {}
  async saveDefinition(
    definition: CohortDefinition,
    registration: CohortRegistration,
    context: CohortValidationContext,
  ): Promise<void> {
    validateCohort(definition, registration, context);
    await this.database.execute(
      sql`INSERT INTO croco_cohort_definitions VALUES (${scopeKey(definition.scope)}, ${definition.id}, ${definition.version}, ${json(definition)})`,
    );
  }
  private async fingerprint(tx: CohortPgExecutor, input: CohortMaterialization): Promise<string> {
    const limits = validateCohort(input.definition, input.registration, input.context);
    const { mapping, definition, snapshotId } = input;
    const scope = sourceScope(definition, mapping, snapshotId);
    const counts = await tx.execute(
      sql`SELECT count(*)::integer AS count, count(DISTINCT ${identifier(mapping.subjectId)})::integer AS unique_count FROM ${identifier(mapping.table)} WHERE ${scope}`,
    );
    const count = Number(counts.rows[0]?.count);
    function predicateCount(node: CohortPredicate): number {
      if (node.kind === "all" || node.kind === "any") {
        return 1 + node.children.reduce((total, child) => total + predicateCount(child), 0);
      }
      return node.kind === "not" ? 1 + predicateCount(node.child) : 1;
    }
    assert(
      Number.isSafeInteger(count) &&
        count <= limits.rows &&
        count * predicateCount(definition.root) <= limits.cost,
      "Source row or cost budget exceeded",
    );
    assert(
      count === Number(counts.rows[0]?.unique_count),
      "Source subject ids must be unique and non-null",
    );
    const result = await tx.execute(
      sql`SELECT md5(COALESCE(string_agg(to_jsonb(s)::text, '' ORDER BY ${identifier(mapping.subjectId)} COLLATE "C"), '')) AS fingerprint FROM ${identifier(mapping.table)} s WHERE ${scope}`,
    );
    return createHash("sha256")
      .update(
        JSON.stringify([
          input.mapping,
          input.registration,
          input.context,
          result.rows[0]?.fingerprint,
        ]),
      )
      .digest("hex");
  }
  async start(input: CohortMaterialization, run: CohortRun): Promise<void> {
    assert(
      run.id &&
        run.definitionVersion === input.definition.version &&
        run.sourceSnapshotRefs.length === 1 &&
        run.sourceSnapshotRefs[0] === input.snapshotId &&
        run.status === "running",
      "Run must pin the definition and source snapshot",
    );
    compileCohortPredicate(
      input.definition,
      input.registration,
      input.context,
      input.mapping,
      run.asOf,
    );
    await this.database.transaction(async (tx) => {
      await tx.execute(sql`LOCK TABLE ${identifier(input.mapping.table)} IN SHARE MODE`);
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${scopeKey(input.definition.scope)},0))`,
      );
      const saved = await tx.execute(
        sql`SELECT definition FROM croco_cohort_definitions WHERE scope_key=${scopeKey(input.definition.scope)} AND id=${input.definition.id} AND version=${input.definition.version} FOR SHARE`,
      );
      assert(
        saved.rows[0] && isDeepStrictEqual(saved.rows[0].definition, input.definition),
        "Run definition must match its saved version",
      );
      const fingerprint = await this.fingerprint(tx, input);
      await tx.execute(
        sql`INSERT INTO croco_cohort_runs (id,scope_key,definition,run,fingerprint,status) VALUES (${run.id},${scopeKey(input.definition.scope)},${json(input.definition)},${json(run)},${fingerprint},'running')`,
      );
    });
  }
  async materializePage(
    input: CohortMaterialization,
    runId: string,
    expectedRevision: number,
    pageSize: number,
  ): Promise<Readonly<{ revision: number; complete: boolean; members: readonly CohortMember[] }>> {
    const limits = validateCohort(input.definition, input.registration, input.context);
    assert(
      Number.isSafeInteger(pageSize) && pageSize > 0 && pageSize <= limits.rows,
      "Invalid page size",
    );
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`LOCK TABLE ${identifier(input.mapping.table)} IN SHARE MODE`);
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${scopeKey(input.definition.scope)},0))`,
      );
      const result = await tx.execute(
        sql`SELECT * FROM croco_cohort_runs WHERE id=${runId} AND scope_key=${scopeKey(input.definition.scope)} FOR UPDATE`,
      );
      const stored = result.rows[0] as StoredRun | undefined;
      assert(
        stored && stored.status === "running" && stored.revision === expectedRevision,
        "Run checkpoint conflict or terminal run",
      );
      assert(
        isDeepStrictEqual(stored.definition, input.definition),
        "Definition changed on resume",
      );
      assert(
        stored.run.sourceSnapshotRefs[0] === input.snapshotId,
        "Source snapshot changed on resume",
      );
      assert(
        stored.fingerprint === (await this.fingerprint(tx, input)),
        "Source snapshot content changed on resume",
      );
      const { mapping, definition, snapshotId } = input;
      const predicate = compileCohortPredicate(
        definition,
        input.registration,
        input.context,
        mapping,
        stored.run.asOf,
      );
      const fields = Object.keys(input.registration.fields)
        .filter((field) => input.context.allowedFields.includes(field))
        .flatMap((field) => {
          const column = mapping.facts[field];
          assert(column, "Missing approved fact mapping");
          return [sql`${field}::text`, sql`${identifier(column)}`];
        });
      const facts = fields.length
        ? sql`jsonb_build_object(${sql.join(fields, sql`,`)})`
        : sql`'{}'::jsonb`;
      const rows = await tx.execute(
        sql`SELECT ${identifier(mapping.subjectId)} AS "subjectId", ${facts} AS facts, ${identifier(mapping.events)} AS events, ${identifier(mapping.coverage)} AS coverage, ${identifier(mapping.memberships)} AS memberships, (${predicate}) AS compiled FROM ${identifier(mapping.table)} WHERE ${sourceScope(definition, mapping, snapshotId)} AND (${stored.checkpoint}::text IS NULL OR ${identifier(mapping.subjectId)} COLLATE "C" > ${stored.checkpoint}) ORDER BY ${identifier(mapping.subjectId)} COLLATE "C" LIMIT ${pageSize}`,
      );
      const members = rows.rows.map((row) => {
        const member = evaluateCohort(definition, row as unknown as CohortSubject, stored.run.asOf);
        assert(
          member.result ===
            (row.compiled === null ? "unknown" : row.compiled ? "match" : "no_match"),
          "Compiler and evaluator disagree",
        );
        return member;
      });
      if (members.length) {
        const erased = await tx.execute(
          sql`SELECT subject_id FROM croco_cohort_erased WHERE scope_key=${scopeKey(definition.scope)} AND subject_id IN (${sql.join(
            members.map((member) => sql`${member.subjectId}`),
            sql`,`,
          )})`,
        );
        assert(
          erased.rows.length === 0,
          "Source contains erased subjects; create a sanitized snapshot",
        );
      }
      if (members.length)
        await tx.execute(
          sql`INSERT INTO croco_cohort_members (run_id,subject_id,member) VALUES ${sql.join(
            members.map((member) => sql`(${runId},${member.subjectId},${json(member)})`),
            sql`,`,
          )}`,
        );
      const complete = members.length < pageSize;
      const checkpoint = members.at(-1)?.subjectId ?? stored.checkpoint;
      await tx.execute(
        sql`UPDATE croco_cohort_runs SET checkpoint=${checkpoint},revision=revision+1,status=${complete ? "complete" : "running"},run=${json({ ...stored.run, status: complete ? "complete" : "running" })} WHERE id=${runId}`,
      );
      return { revision: expectedRevision + 1, complete, members };
    });
  }
  async stop(
    runId: string,
    scope: CohortScope,
    expectedRevision: number,
    status: "failed" | "canceled",
  ): Promise<void> {
    const result = await this.database.execute(
      sql`UPDATE croco_cohort_runs SET status=${status},run=jsonb_set(run,'{status}',${json(status)}),revision=revision+1 WHERE id=${runId} AND scope_key=${scopeKey(scope)} AND revision=${expectedRevision} AND status='running' RETURNING id`,
    );
    assert(result.rows.length === 1, "Run checkpoint conflict");
  }
  async publish(
    runId: string,
    snapshot: CohortSnapshot,
    expectedRevision: number,
    audit: Readonly<{ actor: string; reason: string; idempotencyKey: string }>,
  ): Promise<CohortPublication> {
    assert(
      audit.actor &&
        audit.reason &&
        audit.idempotencyKey &&
        snapshot.publicationRevision === expectedRevision + 1,
      "Publication audit or revision missing",
    );
    return this.database.transaction(async (tx) => {
      const key = scopeKey(snapshot.scope);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`);
      const previous = await tx.execute(
        sql`SELECT publication FROM croco_cohort_publications WHERE scope_key=${key} AND definition_id=${snapshot.definitionId} AND idempotency_key=${audit.idempotencyKey}`,
      );
      if (previous.rows[0]) {
        const publication = previous.rows[0].publication as CohortPublication;
        assert(isDeepStrictEqual(publication.snapshot, snapshot), "Idempotency payload mismatch");
        return publication;
      }
      const current = await tx.execute(
        sql`SELECT revision FROM croco_cohort_current WHERE scope_key=${key} AND definition_id=${snapshot.definitionId}`,
      );
      assert(
        Number(current.rows[0]?.revision ?? 0) === expectedRevision,
        "Publication revision conflict",
      );
      const result = await tx.execute(
        sql`SELECT * FROM croco_cohort_runs WHERE id=${runId} AND scope_key=${key} FOR UPDATE`,
      );
      const stored = result.rows[0] as StoredRun | undefined;
      assert(
        stored?.status === "complete" &&
          stored.definition.id === snapshot.definitionId &&
          stored.definition.version === snapshot.definitionVersion &&
          stored.definition.subjectKind === snapshot.subjectKind &&
          stored.run.asOf === snapshot.asOf &&
          JSON.stringify(stored.run.sourceSnapshotRefs) ===
            JSON.stringify(snapshot.sourceSnapshotRefs),
        "Only the pinned complete run can be published",
      );
      assert(
        snapshot.schemaVersion === 1 &&
          snapshot.membershipRef === runId &&
          snapshot.privacyVersion &&
          cohortTimestamp(snapshot.validUntil) > cohortTimestamp(snapshot.generatedAt) &&
          cohortTimestamp(snapshot.generatedAt) >= cohortTimestamp(snapshot.asOf),
        "Invalid publication metadata",
      );
      const rows = await tx.execute(
        sql`SELECT subject_id FROM croco_cohort_members WHERE run_id=${runId} AND member->>'result'='match' ORDER BY subject_id COLLATE "C"`,
      );
      const subjectIds = rows.rows.map((row) => String(row.subject_id));
      assert(snapshot.contentHash === cohortContentHash(subjectIds), "Membership hash mismatch");
      const publication = { snapshot, subjectIds, withdrawn: false };
      await tx.execute(
        sql`INSERT INTO croco_cohort_publications VALUES (${snapshot.snapshotId},${key},${snapshot.definitionId},${snapshot.publicationRevision},${json(publication)},${audit.actor},${audit.reason},${audit.idempotencyKey})`,
      );
      await tx.execute(
        sql`INSERT INTO croco_cohort_current VALUES (${key},${snapshot.definitionId},${snapshot.publicationRevision},${snapshot.snapshotId}) ON CONFLICT (scope_key,definition_id) DO UPDATE SET revision=EXCLUDED.revision,snapshot_id=EXCLUDED.snapshot_id`,
      );
      return publication;
    });
  }
  async checkpoint(
    runId: string,
    scope: CohortScope,
  ): Promise<Readonly<{ run: CohortRun; revision: number; after: string | null }>> {
    const result = await this.database.execute(
      sql`SELECT run,revision,checkpoint FROM croco_cohort_runs WHERE id=${runId} AND scope_key=${scopeKey(scope)}`,
    );
    const row = result.rows[0];
    assert(row, "Run is absent");
    return {
      run: row.run as CohortRun,
      revision: Number(row.revision),
      after: row.checkpoint as string | null,
    };
  }
  async current(scope: CohortScope, definitionId: string): Promise<CohortPublication | undefined> {
    const result = await this.database.execute(
      sql`SELECT p.publication FROM croco_cohort_current c JOIN croco_cohort_publications p ON p.snapshot_id=c.snapshot_id WHERE c.scope_key=${scopeKey(scope)} AND c.definition_id=${definitionId}`,
    );
    return result.rows[0]?.publication as CohortPublication | undefined;
  }
  async rollback(
    previousSnapshotId: string,
    snapshot: CohortSnapshot,
    expectedRevision: number,
    audit: Readonly<{ actor: string; reason: string; idempotencyKey: string }>,
    privacy: CohortPrivacyReader,
    now: Date,
  ): Promise<CohortPublication> {
    const previous = await new PublishedCohortReader(this, privacy).read(
      previousSnapshotId,
      snapshot.scope,
      snapshot.subjectKind,
      now,
    );
    assert(
      previous.snapshot.definitionId === snapshot.definitionId &&
        previous.snapshot.membershipRef === snapshot.membershipRef &&
        previous.snapshot.contentHash === snapshot.contentHash &&
        previous.snapshot.privacyVersion === snapshot.privacyVersion &&
        cohortContentHash(previous.subjectIds) === snapshot.contentHash,
      "Rollback is incompatible with current privacy or membership",
    );
    assert(
      cohortTimestamp(snapshot.validUntil) <= cohortTimestamp(previous.snapshot.validUntil),
      "Rollback cannot extend retained snapshot validity",
    );
    return this.publish(snapshot.membershipRef, snapshot, expectedRevision, audit);
  }
  /** Erasure invalidates affected publications and completed runs, then prevents source replay. */
  async eraseSubject(scope: CohortScope, subjectId: string): Promise<void> {
    assert(subjectId, "Subject id is required");
    await this.database.transaction(async (tx) => {
      const key = scopeKey(scope);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`);
      await tx.execute(
        sql`INSERT INTO croco_cohort_erased VALUES (${key},${subjectId}) ON CONFLICT DO NOTHING`,
      );
      await tx.execute(
        sql`UPDATE croco_cohort_publications SET publication=jsonb_set(jsonb_set(publication,'{withdrawn}','true'),'{subjectIds}',(SELECT COALESCE(jsonb_agg(member_id ORDER BY ordinal),'[]'::jsonb) FROM jsonb_array_elements(publication->'subjectIds') WITH ORDINALITY AS members(member_id,ordinal) WHERE member_id <> ${json(subjectId)})) WHERE scope_key=${key} AND publication->'subjectIds' @> ${json([subjectId])}`,
      );
      await tx.execute(
        sql`UPDATE croco_cohort_runs SET status='failed',run=jsonb_set(run,'{status}','"failed"'),revision=revision+1 WHERE scope_key=${key} AND id IN (SELECT run_id FROM croco_cohort_members WHERE subject_id=${subjectId})`,
      );
      await tx.execute(
        sql`DELETE FROM croco_cohort_members WHERE subject_id=${subjectId} AND run_id IN (SELECT id FROM croco_cohort_runs WHERE scope_key=${key})`,
      );
    });
  }
  async read(snapshotId: string): Promise<CohortPublication | undefined> {
    const result = await this.database.execute(
      sql`SELECT publication FROM croco_cohort_publications WHERE snapshot_id=${snapshotId}`,
    );
    return result.rows[0]?.publication as CohortPublication | undefined;
  }
  async withdraw(snapshotId: string, scope: CohortScope): Promise<void> {
    const result = await this.database.execute(
      sql`UPDATE croco_cohort_publications SET publication=jsonb_set(publication,'{withdrawn}','true') WHERE snapshot_id=${snapshotId} AND scope_key=${scopeKey(scope)} RETURNING snapshot_id`,
    );
    assert(result.rows.length === 1, "Publication is absent");
  }
}
