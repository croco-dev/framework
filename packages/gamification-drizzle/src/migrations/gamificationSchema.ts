import { sql } from "drizzle-orm";
import { ChallengePersistenceProblem } from "../libs/ChallengePersistenceProblem";
export type GamificationMigrationClient = Readonly<{
  execute(query: ReturnType<typeof sql>): PromiseLike<unknown>;
}>;
const definitions = [
  ["buckets", ""],
  [
    "evidence_attempts",
    "id text not null, event_id text not null, source_id text not null, subject_id text not null, received_at timestamptz not null, state text not null, idempotency_key text not null, fingerprint text not null,",
  ],
  ["erased_events", "event_id text not null,"],
  ["erased_subjects", "subject_hash text not null,"],
  [
    "challenges",
    `version bigint not null, start_at timestamptz not null, end_at timestamptz not null, goal bigint not null, member_cap bigint, min_members bigint not null, late_allowance_ms bigint not null, visibility text not null, leave_policy text not null, state text not null, progress bigint not null, member_count bigint not null, erased_progress bigint not null, finalized_at timestamptz,`,
  ],
  [
    "members",
    "subject_id text not null, intervals jsonb not null, public_consent boolean not null, consent_version bigint not null,",
  ],
  [
    "contributions",
    "event_id text not null, source_id text not null, subject_id text not null, occurred_at timestamptz not null, amount bigint not null, accepted_at timestamptz not null, revision bigint not null, correction_of text,",
  ],
  [
    "receipts",
    "idempotency_key text not null, fingerprint text not null, action text not null, definition_version bigint not null, subject_hash text, actor text not null, reason text not null, recorded_at timestamptz not null,",
  ],
  [
    "completions",
    "id text not null, definition_version bigint not null, progress bigint not null, member_count bigint not null, completed_at timestamptz not null,",
  ],
] as const;
function tableName(name: string): string {
  return name === "challenges" ? "gamification_challenges" : `gamification_challenge_${name}`;
}
export async function createChallengeSchema(client: GamificationMigrationClient): Promise<void> {
  try {
    for (const [name, columns] of definitions) {
      const extraKey =
        name === "members"
          ? ", subject_id"
          : name === "evidence_attempts"
            ? ", id"
            : name === "contributions" || name === "erased_events"
              ? ", event_id"
              : name === "erased_subjects"
                ? ", subject_hash"
                : name === "receipts"
                  ? ", idempotency_key"
                  : "";
      await client.execute(
        sql.raw(
          `create table if not exists ${tableName(name)} (scope_key text not null, challenge_id text not null, ${columns} primary key(scope_key, challenge_id${extraKey}))`,
        ),
      );
    }
  } catch (error) {
    throw new ChallengePersistenceProblem("create-schema", error);
  }
}
export async function dropChallengeSchema(client: GamificationMigrationClient): Promise<void> {
  try {
    for (const [name] of [...definitions].reverse())
      await client.execute(sql.raw(`drop table if exists ${tableName(name)}`));
  } catch (error) {
    throw new ChallengePersistenceProblem("drop-schema", error);
  }
}
