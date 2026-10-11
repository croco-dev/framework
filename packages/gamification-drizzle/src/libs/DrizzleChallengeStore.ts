import {
  assertChallengeScope,
  ChallengeInvalidProblem,
  ChallengeConflictProblem,
  type Challenge,
  type ChallengeStore,
  type ChallengeScope,
  type ChallengeTransaction,
  type ChallengeMember,
  type ChallengeContribution,
  type ChallengeReceipt,
  type ChallengeEvidenceAttempt,
  type ChallengeCompletion,
} from "@croco/gamification-core";
import { Problem } from "@croco/problems-core";
import { and, asc, eq, type SQLWrapper } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as challengeSchema from "./schema";
import { ChallengePersistenceProblem } from "./ChallengePersistenceProblem";
const {
  gamificationChallengeBuckets: buckets,
  gamificationChallenges: challenges,
  gamificationChallengeMembers: members,
  gamificationChallengeContributions: contributions,
  gamificationChallengeReceipts: receipts,
  gamificationChallengeCompletions: completions,
  gamificationChallengeErasedEvents: erasedEvents,
  gamificationChallengeEvidenceAttempts: evidenceAttempts,
  gamificationChallengeErasedSubjects: erasedSubjects,
} = challengeSchema;
export type DrizzleChallengeClient = NodePgDatabase<typeof challengeSchema>;
export class DrizzleChallengeStore implements ChallengeStore {
  constructor(private readonly db: DrizzleChallengeClient) {}
  async transact<T>(
    scope: ChallengeScope,
    challengeId: string,
    operation: (transaction: ChallengeTransaction) => Promise<T>,
  ): Promise<T> {
    assertChallengeScope(scope, challengeId);
    const scopeKey = JSON.stringify([scope.app, scope.environment, scope.tenantId]);
    const key = { scopeKey, challengeId };
    const where = (table: { scopeKey: SQLWrapper; challengeId: SQLWrapper }) =>
      and(eq(table.scopeKey, scopeKey), eq(table.challengeId, challengeId));
    try {
      return await this.db.transaction(async (tx) => {
        await tx.insert(buckets).values(key).onConflictDoNothing();
        await tx.select().from(buckets).where(where(buckets)).for("update");
        const [stored] = await tx.select().from(challenges).where(where(challenges));
        let challenge: Challenge | null = null;
        if (stored) {
          const { scopeKey: _key, challengeId: _id, ...value } = stored;
          challenge = { ...value, id: challengeId, scope: { ...scope } };
        }
        const memberMap = new Map<string, ChallengeMember>(
          (
            await tx.select().from(members).where(where(members)).orderBy(asc(members.subjectId))
          ).map((row) => [
            row.subjectId,
            {
              subjectId: row.subjectId,
              publicConsent: row.publicConsent,
              consentVersion: row.consentVersion,
              intervals: row.intervals.map((i) => ({
                joinedAt: new Date(i.joinedAt),
                leftAt: i.leftAt === null ? null : new Date(i.leftAt),
              })),
            },
          ]),
        );
        const contributionMap = new Map<string, ChallengeContribution>(
          (
            await tx
              .select()
              .from(contributions)
              .where(where(contributions))
              .orderBy(
                asc(contributions.acceptedAt),
                asc(contributions.revision),
                asc(contributions.eventId),
              )
          ).map(({ scopeKey: _scope, challengeId: _id, ...row }) => [row.eventId, row]),
        );
        const receiptMap = new Map<string, ChallengeReceipt>(
          (await tx.select().from(receipts).where(where(receipts))).map(
            ({ scopeKey: _scope, challengeId: _id, ...row }) => [row.idempotencyKey, row],
          ),
        );
        const attemptMap = new Map<string, ChallengeEvidenceAttempt>(
          (await tx.select().from(evidenceAttempts).where(where(evidenceAttempts))).map(
            ({ scopeKey: _scope, challengeId: _id, ...row }) => [row.id, row],
          ),
        );
        const [storedCompletion] = await tx.select().from(completions).where(where(completions));
        let completion: ChallengeCompletion | null = storedCompletion
          ? {
              id: storedCompletion.id,
              challengeId,
              definitionVersion: storedCompletion.definitionVersion,
              progress: storedCompletion.progress,
              memberCount: storedCompletion.memberCount,
              completedAt: storedCompletion.completedAt,
            }
          : null;
        const erasedEventIds = new Set(
          (await tx.select().from(erasedEvents).where(where(erasedEvents))).map(
            (row) => row.eventId,
          ),
        );
        const erasedSubjectHashes = new Set(
          (await tx.select().from(erasedSubjects).where(where(erasedSubjects))).map(
            (row) => row.subjectHash,
          ),
        );
        let dirty = false;
        const result = await operation({
          get challenge() {
            return structuredClone(challenge);
          },
          get members() {
            return structuredClone([...memberMap.values()]);
          },
          get contributions() {
            return structuredClone([...contributionMap.values()]);
          },
          get evidenceAttempts() {
            return structuredClone([...attemptMap.values()]);
          },
          saveEvidenceAttempt(value) {
            const previous = attemptMap.get(value.id);
            if (previous && previous.state !== "unknown" && value.state !== previous.state)
              throw new ChallengeConflictProblem("Settled evidence cannot change state");
            attemptMap.set(value.id, structuredClone(value));
            dirty = true;
          },
          get receipts() {
            return structuredClone([...receiptMap.values()]);
          },
          get completion() {
            return structuredClone(completion);
          },
          get erasedEventIds() {
            return [...erasedEventIds];
          },
          get erasedSubjectHashes() {
            return [...erasedSubjectHashes];
          },
          saveChallenge(value) {
            assertChallengeScope(value.scope, value.id);
            if (
              value.id !== challengeId ||
              JSON.stringify([value.scope.app, value.scope.environment, value.scope.tenantId]) !==
                scopeKey
            )
              throw new ChallengeInvalidProblem("Challenge does not belong to locked scope");
            challenge = structuredClone(value);
            dirty = true;
          },
          saveMember(value) {
            memberMap.set(value.subjectId, structuredClone(value));
            dirty = true;
          },
          saveContribution(value) {
            contributionMap.set(value.eventId, structuredClone(value));
            dirty = true;
          },
          saveReceipt(value) {
            receiptMap.set(value.idempotencyKey, structuredClone(value));
            dirty = true;
          },
          saveCompletion(value) {
            if (value.challengeId !== challengeId)
              throw new ChallengeInvalidProblem("Completion does not belong to locked challenge");
            if (
              completion &&
              (completion.id !== value.id ||
                completion.definitionVersion !== value.definitionVersion ||
                completion.progress !== value.progress ||
                completion.memberCount !== value.memberCount ||
                completion.completedAt.getTime() !== value.completedAt.getTime())
            )
              throw new ChallengeConflictProblem("Completion is immutable");
            completion = structuredClone(value);
            dirty = true;
          },
          eraseSubject(subjectId, subjectHash) {
            memberMap.delete(subjectId);
            for (const [id, value] of attemptMap)
              if (value.subjectId === subjectId) attemptMap.delete(id);
            erasedSubjectHashes.add(subjectHash);
            for (const [id, value] of contributionMap)
              if (value.subjectId === subjectId) {
                contributionMap.delete(id);
                erasedEventIds.add(id);
              }
            for (const [id, value] of receiptMap)
              if (value.subjectHash === subjectHash || value.actor === subjectId)
                receiptMap.set(id, { ...value, subjectHash: null, actor: "", reason: "" });
            dirty = true;
          },
        });
        if (!dirty) return result;
        if (!challenge) throw new ChallengeInvalidProblem("Child records require a challenge");
        for (const value of contributionMap.values())
          if (!memberMap.has(value.subjectId))
            throw new ChallengeInvalidProblem(
              "Contribution requires membership in the locked challenge",
            );
        const challengeRow = {
          version: challenge.version,
          start: challenge.start,
          end: challenge.end,
          goal: challenge.goal,
          memberCap: challenge.memberCap,
          minMembers: challenge.minMembers,
          lateAllowanceMs: challenge.lateAllowanceMs,
          visibility: challenge.visibility,
          leavePolicy: challenge.leavePolicy,
          state: challenge.state,
          progress: challenge.progress,
          memberCount: challenge.memberCount,
          erasedProgress: challenge.erasedProgress,
          finalizedAt: challenge.finalizedAt,
        };
        await tx
          .insert(challenges)
          .values({ ...challengeRow, ...key })
          .onConflictDoUpdate({
            target: [challenges.scopeKey, challenges.challengeId],
            set: challengeRow,
          });
        for (const table of [
          members,
          contributions,
          receipts,
          erasedEvents,
          erasedSubjects,
          evidenceAttempts,
        ])
          await tx.delete(table).where(where(table));
        if (memberMap.size)
          await tx.insert(members).values(
            [...memberMap.values()].map((v) => ({
              ...v,
              ...key,
              intervals: v.intervals.map((i) => ({
                joinedAt: i.joinedAt.toISOString(),
                leftAt: i.leftAt?.toISOString() ?? null,
              })),
            })),
          );
        if (contributionMap.size)
          await tx
            .insert(contributions)
            .values([...contributionMap.values()].map((v) => ({ ...v, ...key })));
        if (attemptMap.size)
          await tx
            .insert(evidenceAttempts)
            .values([...attemptMap.values()].map((v) => ({ ...v, ...key })));
        if (receiptMap.size)
          await tx.insert(receipts).values([...receiptMap.values()].map((v) => ({ ...v, ...key })));
        if (erasedEventIds.size)
          await tx
            .insert(erasedEvents)
            .values([...erasedEventIds].map((eventId) => ({ ...key, eventId })));
        if (erasedSubjectHashes.size)
          await tx
            .insert(erasedSubjects)
            .values([...erasedSubjectHashes].map((subjectHash) => ({ ...key, subjectHash })));
        if (completion)
          await tx
            .insert(completions)
            .values({ ...completion, ...key })
            .onConflictDoNothing();
        return result;
      });
    } catch (error) {
      if (error instanceof Problem) throw error;
      throw new ChallengePersistenceProblem("transact", error);
    }
  }
}
