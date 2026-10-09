import "reflect-metadata";
import { MissionInvalidProblem } from "@croco/gamification-core";
import { addGamificationMissions, DrizzleMissionStore } from "@croco/gamification-drizzle";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sessions, scope, subjectId, missionId } from "./domain";
import type { SQL } from "drizzle-orm";
import type { DrizzleMissionClient } from "@croco/gamification-drizzle";

async function main(): Promise<void> {
  const connectionString = process.env.GAMIFICATION_POSTGRES_URL;
  if (!connectionString) throw new MissionInvalidProblem("GAMIFICATION_POSTGRES_URL is required");
  const pool = new Pool({ connectionString });
  try {
    const db = drizzle(pool) as unknown as DrizzleMissionClient;
    const txManager = new TxManager(createDrizzleTxAdapter(db));
    await txManager.run(async () => {
      const client = txManager.getClient();
      if (!client) throw new MissionInvalidProblem("Migration transaction missing");
      await addGamificationMissions({ execute: (query) => client.execute(query as SQL) });
      await client.execute(sql`
        create table if not exists croco_outbox_messages (
          id varchar(128) primary key, event_id varchar(128) not null, event_type text not null,
          aggregate_id text, idempotency_key varchar(255) not null unique,
          payload jsonb not null, metadata jsonb not null, trace_context jsonb,
          attempts integer not null default 0, max_attempts integer not null default 3,
          status text not null, visible_at timestamp not null, occurred_at timestamp not null,
          created_at timestamp not null default now(), updated_at timestamp not null default now(),
          locked_until timestamp, published_at timestamp, last_error jsonb,
          dead_lettered_at timestamp, dead_letter_reason text, diagnostics jsonb not null
        )`);
      await client.execute(sql`
        create table if not exists mission_example_reports (
          id text primary key, tenant_id text not null, app_id text not null,
          environment_id text not null, subject_id text not null, episode_id text not null,
          version integer not null, name text not null, occurred_at timestamptz not null
        )`);
      await client.execute(sql`
        create table if not exists mission_example_session (
          id text primary key, active_version integer not null,
          latest_version integer not null, latest_revision integer not null, episode_id text not null
        )`);
      const store = new DrizzleMissionStore(db, txManager);
      await client.execute(sql`
        create table if not exists mission_example_episode_commands (
          command_id text primary key, version integer not null, episode_id text not null
        )`);
      await store.publish({
        scope,
        definition: {
          id: missionId,
          version: 1,
          actionId: "report.saved",
          countMode: "events",
          unit: "event",
          timezone: "Asia/Seoul",
          period: "week",
          anchor: "2026-01-05",
          target: 3,
          perPeriodCap: 3,
          lateAcceptanceMs: 86400000,
          closedCorrection: "recalculate",
        },
        actorId: "demo-operator",
        reason: "Standalone weekly report mission",
        revision: 1,
        idempotencyKey: "mission-example-initial",
        publishedAt: "2026-01-05T00:00:00.000Z",
      });
      await client
        .insert(sessions)
        .values({
          id: subjectId,
          activeVersion: 1,
          latestVersion: 1,
          latestRevision: 1,
          episodeId: "initial",
        })
        .onConflictDoNothing();
    });
    process.stdout.write("Mission migration and demo publication complete\n");
  } finally {
    await pool.end();
  }
}
void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
