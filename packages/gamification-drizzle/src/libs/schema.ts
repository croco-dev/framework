import type { ChallengeAction } from "@croco/gamification-core";
import { bigint, boolean, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const keys = () => ({
  scopeKey: text("scope_key").notNull(),
  challengeId: text("challenge_id").notNull(),
});
export const gamificationChallengeBuckets = pgTable(
  "gamification_challenge_buckets",
  keys(),
  (t) => [primaryKey({ columns: [t.scopeKey, t.challengeId] })],
);
export const gamificationChallenges = pgTable(
  "gamification_challenges",
  {
    ...keys(),
    version: bigint("version", { mode: "number" }).notNull(),
    start: timestamp("start_at", { withTimezone: true }).notNull(),
    end: timestamp("end_at", { withTimezone: true }).notNull(),
    goal: bigint("goal", { mode: "number" }).notNull(),
    memberCap: bigint("member_cap", { mode: "number" }),
    minMembers: bigint("min_members", { mode: "number" }).notNull(),
    lateAllowanceMs: bigint("late_allowance_ms", { mode: "number" }).notNull(),
    visibility: text("visibility").$type<"aggregate" | "consented">().notNull(),
    leavePolicy: text("leave_policy").$type<"retain" | "remove">().notNull(),
    state: text("state")
      .$type<"scheduled" | "active" | "closing" | "completed" | "expired">()
      .notNull(),
    progress: bigint("progress", { mode: "number" }).notNull(),
    memberCount: bigint("member_count", { mode: "number" }).notNull(),
    erasedProgress: bigint("erased_progress", { mode: "number" }).notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.scopeKey, t.challengeId] })],
);
export const gamificationChallengeMembers = pgTable(
  "gamification_challenge_members",
  {
    ...keys(),
    subjectId: text("subject_id").notNull(),
    intervals: jsonb("intervals")
      .$type<readonly { joinedAt: string; leftAt: string | null }[]>()
      .notNull(),
    publicConsent: boolean("public_consent").notNull(),
    consentVersion: bigint("consent_version", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.scopeKey, t.challengeId, t.subjectId] })],
);
export const gamificationChallengeContributions = pgTable(
  "gamification_challenge_contributions",
  {
    ...keys(),
    eventId: text("event_id").notNull(),
    sourceId: text("source_id").notNull(),
    subjectId: text("subject_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    revision: bigint("revision", { mode: "number" }).notNull(),
    correctionOf: text("correction_of"),
  },
  (t) => [primaryKey({ columns: [t.scopeKey, t.challengeId, t.eventId] })],
);
export const gamificationChallengeReceipts = pgTable(
  "gamification_challenge_receipts",
  {
    ...keys(),
    idempotencyKey: text("idempotency_key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    action: text("action").$type<ChallengeAction>().notNull(),
    definitionVersion: bigint("definition_version", { mode: "number" }).notNull(),
    subjectHash: text("subject_hash"),
    actor: text("actor").notNull(),
    reason: text("reason").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.scopeKey, t.challengeId, t.idempotencyKey] })],
);
export const gamificationChallengeCompletions = pgTable(
  "gamification_challenge_completions",
  {
    ...keys(),
    id: text("id").notNull(),
    definitionVersion: bigint("definition_version", { mode: "number" }).notNull(),
    progress: bigint("progress", { mode: "number" }).notNull(),
    memberCount: bigint("member_count", { mode: "number" }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.scopeKey, t.challengeId] })],
);

export const gamificationChallengeErasedEvents = pgTable(
  "gamification_challenge_erased_events",
  { ...keys(), eventId: text("event_id").notNull() },
  (t) => [primaryKey({ columns: [t.scopeKey, t.challengeId, t.eventId] })],
);
export const gamificationChallengeErasedSubjects = pgTable(
  "gamification_challenge_erased_subjects",
  { ...keys(), subjectHash: text("subject_hash").notNull() },
  (t) => [primaryKey({ columns: [t.scopeKey, t.challengeId, t.subjectHash] })],
);

export const gamificationChallengeEvidenceAttempts = pgTable(
  "gamification_challenge_evidence_attempts",
  {
    ...keys(),
    id: text("id").notNull(),
    eventId: text("event_id").notNull(),
    sourceId: text("source_id").notNull(),
    subjectId: text("subject_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    state: text("state").$type<"unknown" | "accepted" | "rejected">().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    fingerprint: text("fingerprint").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scopeKey, t.challengeId, t.id] })],
);
