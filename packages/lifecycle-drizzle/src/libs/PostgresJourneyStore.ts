import { sql } from "drizzle-orm";
import { JourneyProblem, validateJourneyScope } from "@croco/lifecycle-core";
import type { SQL } from "drizzle-orm";
import type { JourneyEpisode, JourneyScope, JourneyStore } from "@croco/lifecycle-core";

export interface JourneyPgDatabase {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}

function scopeKey(scope: JourneyScope): string {
  validateJourneyScope(scope);
  return JSON.stringify([scope.appId, scope.environment, scope.tenantId]);
}

/** PostgreSQL CAS is the atomic wake/admission fence for the complete episode and its receipts/intents. */
export class PostgresJourneyStore implements JourneyStore {
  constructor(private readonly database: JourneyPgDatabase) {}

  async create(episode: JourneyEpisode): Promise<{ episode: JourneyEpisode; created: boolean }> {
    const key = scopeKey(episode.scope);
    const result = await this.database.execute(sql`
      INSERT INTO croco_journey_episodes (scope_key, id, reentry_key, revision, episode)
      VALUES (${key}, ${episode.id}, ${episode.reentryKey}, ${episode.revision}, ${JSON.stringify(episode)}::jsonb)
      ON CONFLICT (scope_key, reentry_key) DO NOTHING RETURNING episode
    `);
    if (result.rows[0]) return { episode: result.rows[0].episode as JourneyEpisode, created: true };
    // A separate statement sees the winning concurrent INSERT after its uniqueness lock is released.
    const prior = await this.database.execute(sql`
      SELECT episode FROM croco_journey_episodes WHERE scope_key = ${key} AND reentry_key = ${episode.reentryKey}
    `);
    if (!prior.rows[0])
      throw new JourneyProblem("store-corrupt", "Conflicting Journey episode is missing");
    return { episode: prior.rows[0].episode as JourneyEpisode, created: false };
  }

  async get(scope: JourneyScope, id: string): Promise<JourneyEpisode | undefined> {
    const result = await this.database.execute(sql`
      SELECT episode FROM croco_journey_episodes WHERE scope_key = ${scopeKey(scope)} AND id = ${id}
    `);
    return result.rows[0]?.episode as JourneyEpisode | undefined;
  }

  async list(scope: JourneyScope): Promise<JourneyEpisode[]> {
    const result = await this.database.execute(sql`
      SELECT episode FROM croco_journey_episodes WHERE scope_key = ${scopeKey(scope)} ORDER BY id LIMIT 1001
    `);
    if (result.rows.length > 1000)
      throw new JourneyProblem(
        "scope-limit",
        "Journey scope exceeds the 1000 episode listing limit",
      );
    return result.rows.map((row) => row.episode as JourneyEpisode);
  }

  async claimDue(
    scope: JourneyScope,
    now: string,
    limit: number,
    leaseMs: number,
  ): Promise<JourneyEpisode[]> {
    const key = scopeKey(scope);
    const timestamp = Date.parse(now);
    if (
      !Number.isFinite(timestamp) ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 1000 ||
      !Number.isSafeInteger(leaseMs) ||
      leaseMs < 1 ||
      !Number.isFinite(new Date(timestamp + leaseMs).getTime())
    ) {
      throw new JourneyProblem(
        "claim",
        "Wake claim requires a valid timestamp, limit 1–1000 and positive lease",
      );
    }
    const result = await this.database.execute(sql`
      WITH due AS (
        SELECT scope_key, id FROM croco_journey_episodes
        WHERE scope_key = ${key}
          AND (episode->>'status' = 'running' OR (episode->>'status' = 'waiting'
            AND (episode->>'wakeAt')::timestamptz <= ${now}::timestamptz))
          AND (wake_claim_until IS NULL OR wake_claim_until <= ${now}::timestamptz)
        ORDER BY episode->>'wakeAt', id
        FOR UPDATE SKIP LOCKED LIMIT ${limit}
      )
      UPDATE croco_journey_episodes AS target
      SET wake_claim_until = ${new Date(timestamp + leaseMs).toISOString()}::timestamptz
      FROM due WHERE target.scope_key = due.scope_key AND target.id = due.id
      RETURNING target.episode
    `);
    return result.rows.map((row) => row.episode as JourneyEpisode);
  }

  async compareAndSet(
    scope: JourneyScope,
    id: string,
    expectedRevision: number,
    next: JourneyEpisode,
  ): Promise<boolean> {
    const key = scopeKey(scope);
    if (key !== scopeKey(next.scope) || id !== next.id || next.revision !== expectedRevision + 1) {
      throw new JourneyProblem(
        "stale-revision",
        "Journey CAS requires matching identity and next revision",
      );
    }
    const result = await this.database.execute(sql`
      UPDATE croco_journey_episodes SET revision = ${next.revision}, episode = ${JSON.stringify(next)}::jsonb, wake_claim_until = NULL
      WHERE scope_key = ${key} AND id = ${id} AND revision = ${expectedRevision}
        AND reentry_key = ${next.reentryKey}
        AND episode->>'definitionId' = ${next.definitionId}
        AND episode->>'definitionVersion' = ${next.definitionVersion}
        AND episode->>'definitionSnapshot' = ${next.definitionSnapshot}
        AND episode->>'subject' = ${next.subject}
        AND episode->>'businessObjectRef' = ${next.businessObjectRef}
        AND episode->>'sourceEventId' = ${next.sourceEventId}
        AND episode->>'episodeKey' = ${next.episodeKey}
        AND episode->>'startedAt' = ${next.startedAt}
      RETURNING id
    `);
    return result.rows.length === 1;
  }
}
