import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const reports = pgTable("mission_example_reports", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  appId: text("app_id").notNull(),
  environmentId: text("environment_id").notNull(),
  subjectId: text("subject_id").notNull(),
  episodeId: text("episode_id").notNull(),
  version: integer("version").notNull(),
  name: text("name").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
});

export const sessions = pgTable("mission_example_session", {
  id: text("id").primaryKey(),
  activeVersion: integer("active_version").notNull(),
  latestVersion: integer("latest_version").notNull(),
  latestRevision: integer("latest_revision").notNull(),
  episodeId: text("episode_id").notNull(),
});

export const episodeCommands = pgTable("mission_example_episode_commands", {
  commandId: text("command_id").primaryKey(),
  version: integer("version").notNull(),
  episodeId: text("episode_id").notNull(),
});

export const scope = { tenantId: "mission-demo", appId: "reports", environmentId: "local" };
export const subjectId = "demo-member";
export const missionId = "save-reports";
