import type {
  MissionAggregate,
  MissionCompletion,
  MissionEvidenceReceipt,
  MissionPublication,
} from "@croco/gamification-core";
import { foreignKey, integer, jsonb, pgTable, primaryKey, text, unique } from "drizzle-orm/pg-core";

const scopeColumns = () => ({
  tenantId: text("tenant_id").notNull(),
  appId: text("app_id").notNull(),
  environmentId: text("environment_id").notNull(),
});
const keyColumns = () => ({
  ...scopeColumns(),
  subjectId: text("subject_id").notNull(),
  missionId: text("mission_id").notNull(),
  version: integer("version").notNull(),
  episodeId: text("episode_id").notNull(),
  periodKey: text("period_key").notNull(),
});

export const missionDefinitions = pgTable(
  "gamification_definitions",
  {
    ...scopeColumns(),
    missionId: text("mission_id").notNull(),
    version: integer("version").notNull(),
    revision: integer("revision").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    publication: jsonb("publication").$type<MissionPublication>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.appId, t.environmentId, t.missionId, t.version] }),
    unique().on(t.tenantId, t.appId, t.environmentId, t.missionId, t.revision),
    unique().on(t.tenantId, t.appId, t.environmentId, t.missionId, t.idempotencyKey),
  ],
);

export const missionInstances = pgTable(
  "gamification_instances",
  {
    ...keyColumns(),
    definition: jsonb("definition").$type<MissionAggregate["definition"]>().notNull(),
    instances: jsonb("instances").$type<MissionAggregate["instances"]>().notNull(),
  },
  (t) => [
    primaryKey({
      columns: [
        t.tenantId,
        t.appId,
        t.environmentId,
        t.subjectId,
        t.missionId,
        t.version,
        t.episodeId,
        t.periodKey,
      ],
    }),
  ],
);

export const missionEvidence = pgTable(
  "gamification_evidence",
  {
    ...keyColumns(),
    eventId: text("event_id").notNull(),
    receipt: jsonb("receipt").$type<MissionEvidenceReceipt>().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [
        t.tenantId,
        t.appId,
        t.environmentId,
        t.subjectId,
        t.missionId,
        t.version,
        t.episodeId,
        t.periodKey,
      ],
      foreignColumns: [
        missionInstances.tenantId,
        missionInstances.appId,
        missionInstances.environmentId,
        missionInstances.subjectId,
        missionInstances.missionId,
        missionInstances.version,
        missionInstances.episodeId,
        missionInstances.periodKey,
      ],
    }),
    primaryKey({
      columns: [t.tenantId, t.appId, t.environmentId, t.subjectId, t.missionId, t.eventId],
    }),
  ],
);

export const missionCompletions = pgTable(
  "gamification_completions",
  {
    ...keyColumns(),
    completionPeriodKey: text("completion_period_key").notNull(),
    completion: jsonb("completion").$type<MissionCompletion>().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [
        t.tenantId,
        t.appId,
        t.environmentId,
        t.subjectId,
        t.missionId,
        t.version,
        t.episodeId,
        t.periodKey,
      ],
      foreignColumns: [
        missionInstances.tenantId,
        missionInstances.appId,
        missionInstances.environmentId,
        missionInstances.subjectId,
        missionInstances.missionId,
        missionInstances.version,
        missionInstances.episodeId,
        missionInstances.periodKey,
      ],
    }),
    primaryKey({
      columns: [
        t.tenantId,
        t.appId,
        t.environmentId,
        t.subjectId,
        t.missionId,
        t.version,
        t.episodeId,
        t.periodKey,
        t.completionPeriodKey,
      ],
    }),
  ],
);
