import { createHash } from "node:crypto";
import {
  assertChallengeDefinition,
  assertChallengeScope,
  ChallengeAccessDeniedProblem,
  ChallengeConflictProblem,
  ChallengeEvidenceProblem,
  ChallengeEvidenceUnavailableProblem,
  ChallengeInvalidProblem,
  ChallengeNotFoundProblem,
  nonempty,
  validDate,
} from "./ChallengeContracts";
import type {
  Challenge,
  ChallengeAccess,
  ChallengeAction,
  ChallengeCommand,
  ChallengeContribution,
  ChallengeDefinition,
  ChallengeMember,
  ChallengeStore,
  ChallengeTransaction,
  ChallengeView,
} from "./ChallengeContracts";
export type ChallengeEvidence = Omit<ChallengeContribution, "sourceId" | "eventId" | "acceptedAt">;
export type ChallengeServiceOptions = Readonly<{
  store: ChallengeStore;
  clock: () => Date;
  /** Verify the actor may act on this scoped subject; erasure must allow authorized former-member targets. */
  authorize: (access: ChallengeAccess, action: ChallengeAction) => Promise<boolean>;
  isMember: (access: ChallengeAccess) => Promise<boolean>;
  sources: Readonly<
    Record<string, (access: ChallengeAccess, eventId: string) => Promise<ChallengeEvidence>>
  >;
}>;
export class ChallengeService {
  constructor(private readonly options: ChallengeServiceOptions) {}
  async create(
    command: ChallengeCommand & { definition: ChallengeDefinition },
  ): Promise<ChallengeView> {
    command = structuredClone(command);
    return this.mutate(command, "create", command.definition, (tx, now) => {
      const definition = snapshotDefinition(command.definition);
      assertChallengeDefinition(definition);
      if (
        definition.id !== command.challengeId ||
        scopeKey(definition.scope) !== scopeKey(command.scope) ||
        definition.version !== 1 ||
        definition.start < now
      )
        throw new ChallengeInvalidProblem(
          "Definition identity, initial version or start is invalid",
        );
      if (tx.challenge) throw new ChallengeConflictProblem("Challenge already exists");
      tx.saveChallenge({
        ...definition,
        state: "scheduled",
        progress: 0,
        memberCount: 0,
        erasedProgress: 0,
        finalizedAt: null,
      });
    });
  }
  async updateDefinition(
    command: ChallengeCommand & { definition: ChallengeDefinition; expectedVersion: number },
  ): Promise<ChallengeView> {
    command = structuredClone(command);
    return this.mutate(
      command,
      "updateDefinition",
      [command.definition, command.expectedVersion],
      (tx, now) => {
        const current = required(tx);
        assertChallengeDefinition(command.definition);
        if (
          now >= current.start ||
          current.version !== command.expectedVersion ||
          command.definition.version !== current.version + 1
        )
          throw new ChallengeConflictProblem(
            "Started policy is immutable; expected version must match",
          );
        if (
          command.definition.id !== current.id ||
          scopeKey(command.definition.scope) !== scopeKey(current.scope) ||
          command.definition.start < now
        )
          throw new ChallengeInvalidProblem("Definition identity or start is invalid");
        if (tx.members.length) throw new ChallengeConflictProblem("Consented policy cannot change");
        tx.saveChallenge({ ...current, ...snapshotDefinition(command.definition) });
      },
    );
  }
  async join(
    command: ChallengeCommand & {
      consentVersion: number;
      leavePolicy: ChallengeDefinition["leavePolicy"];
      publicConsent?: boolean;
    },
  ): Promise<ChallengeView> {
    command = structuredClone(command);
    return this.mutate(
      command,
      "join",
      [command.consentVersion, command.leavePolicy, command.publicConsent ?? false],
      (tx, now) => {
        const challenge = required(tx);
        if (tx.erasedSubjectHashes.includes(hash(command.subjectId)))
          throw new ChallengeConflictProblem(
            "Erased participation cannot resume in this challenge",
          );
        if (now >= challenge.end || challenge.finalizedAt)
          throw new ChallengeConflictProblem("Joining is closed");
        if (
          command.consentVersion !== challenge.version ||
          command.leavePolicy !== challenge.leavePolicy ||
          (command.publicConsent !== undefined && typeof command.publicConsent !== "boolean")
        )
          throw new ChallengeInvalidProblem("Explicit current policy consent is required");
        const member = tx.members.find((item) => item.subjectId === command.subjectId);
        if (member?.intervals.some((item) => item.leftAt === null))
          throw new ChallengeConflictProblem("Already joined");
        tx.saveMember({
          subjectId: command.subjectId,
          intervals: [...(member?.intervals ?? []), { joinedAt: now, leftAt: null }],
          publicConsent: command.publicConsent ?? false,
          consentVersion: challenge.version,
        });
      },
    );
  }
  async leave(command: ChallengeCommand): Promise<ChallengeView> {
    command = structuredClone(command);
    return this.mutate(command, "leave", null, (tx, now) => {
      const member = tx.members.find((item) => item.subjectId === command.subjectId);
      if (!member) throw new ChallengeConflictProblem("Subject has not joined");
      tx.saveMember({
        ...member,
        publicConsent: false,
        intervals: member.intervals.map((item) =>
          item.leftAt === null ? { ...item, leftAt: now } : item,
        ),
      });
    });
  }
  async contribute(
    command: ChallengeCommand & { sourceId: string; eventId: string },
  ): Promise<ChallengeView> {
    command = structuredClone(command);
    const previous = await this.registerEvidenceAttempt(command);
    if (previous) return previous;
    try {
      if (
        !nonempty(command.sourceId) ||
        !nonempty(command.eventId) ||
        !Object.hasOwn(this.options.sources, command.sourceId)
      )
        throw new ChallengeEvidenceProblem("Unknown evidence source or invalid event id");
      const verify = this.options.sources[command.sourceId];
      if (!verify) throw new ChallengeEvidenceProblem("Unknown evidence source");
      let evidence: ChallengeEvidence;
      try {
        evidence = structuredClone(await verify(structuredClone(command), command.eventId));
      } catch (error) {
        if (error instanceof ChallengeEvidenceProblem) throw error;
        throw new ChallengeEvidenceUnavailableProblem(error);
      }
      return await this.mutate(
        command,
        "contribute",
        [command.sourceId, command.eventId],
        (tx, now) => {
          const challenge = required(tx);
          if (tx.erasedSubjectHashes.includes(hash(command.subjectId)))
            throw new ChallengeConflictProblem(
              "Erased participation cannot resume in this challenge",
            );
          if (
            challenge.finalizedAt ||
            !tx.evidenceAttempts.some(
              (item) =>
                item.id === attemptKey(command) &&
                item.state === "unknown" &&
                item.receivedAt.getTime() < challenge.end.getTime() + challenge.lateAllowanceMs,
            )
          )
            throw new ChallengeConflictProblem("Contribution window is closed");
          if (
            !evidence ||
            evidence.subjectId !== command.subjectId ||
            !validDate(evidence.occurredAt) ||
            evidence.occurredAt < challenge.start ||
            evidence.occurredAt >= challenge.end ||
            evidence.occurredAt > now ||
            !Number.isSafeInteger(evidence.amount) ||
            evidence.amount < 0 ||
            !Number.isSafeInteger(evidence.revision) ||
            evidence.revision < 1 ||
            (evidence.correctionOf !== null && !nonempty(evidence.correctionOf))
          )
            throw new ChallengeEvidenceProblem("Invalid verified evidence");
          const eventId = eventKey(command.eventId);
          if (
            tx.contributions.some((item) => item.eventId === eventId) ||
            tx.erasedEventIds.includes(eventId)
          )
            throw new ChallengeEvidenceProblem("Event already consumed");
          const member = tx.members.find((item) => item.subjectId === command.subjectId);
          if (
            !member ||
            !member.intervals.some(
              (item) =>
                item.joinedAt <= evidence.occurredAt &&
                (item.leftAt === null || evidence.occurredAt < item.leftAt),
            )
          )
            throw new ChallengeEvidenceProblem("Event is outside consented membership");
          const correctionOf =
            evidence.correctionOf === null ? null : eventKey(evidence.correctionOf);
          if (correctionOf !== null) {
            const original = tx.contributions.find((item) => item.eventId === correctionOf);
            if (
              !original ||
              original.subjectId !== command.subjectId ||
              original.sourceId !== command.sourceId ||
              original.correctionOf !== null ||
              original.occurredAt.getTime() !== evidence.occurredAt.getTime()
            )
              throw new ChallengeEvidenceProblem(
                "Correction must reference this subject original accepted event and occurrence",
              );
          }
          if (
            correctionOf !== null &&
            tx.contributions.some(
              (item) =>
                (item.eventId === correctionOf || item.correctionOf === correctionOf) &&
                item.revision >= evidence.revision,
            )
          )
            throw new ChallengeEvidenceProblem("Correction revision must advance");
          const attempt = tx.evidenceAttempts.find((item) => item.id === attemptKey(command));
          if (!attempt || attempt.state !== "unknown")
            throw new ChallengeConflictProblem("Evidence attempt is no longer pending");
          for (const other of tx.evidenceAttempts) {
            if (other.id !== attempt.id && other.eventId === eventId && other.state === "unknown") {
              tx.saveEvidenceAttempt({ ...other, state: "rejected" });
            }
          }
          tx.saveEvidenceAttempt({ ...attempt, state: "accepted" });
          tx.saveContribution({
            subjectId: evidence.subjectId,
            occurredAt: evidence.occurredAt,
            amount: evidence.amount,
            revision: evidence.revision,
            eventId,
            sourceId: command.sourceId,
            correctionOf,
            acceptedAt: now,
          });
        },
      );
    } catch (error) {
      if (error instanceof ChallengeEvidenceProblem || error instanceof ChallengeInvalidProblem) {
        await this.options.store.transact(command.scope, command.challengeId, async (tx) => {
          const attempt = tx.evidenceAttempts.find((item) => item.id === attemptKey(command));
          if (attempt?.state === "unknown")
            tx.saveEvidenceAttempt({ ...attempt, state: "rejected" });
        });
      }
      throw error;
    }
  }
  private async registerEvidenceAttempt(
    command: ChallengeCommand & { sourceId: string; eventId: string },
  ): Promise<ChallengeView | null> {
    await this.authorize(command, "contribute");
    if (!nonempty(command.idempotencyKey))
      throw new ChallengeInvalidProblem("Idempotency key is required");
    if (
      !nonempty(command.sourceId) ||
      !nonempty(command.eventId) ||
      !Object.hasOwn(this.options.sources, command.sourceId)
    )
      throw new ChallengeEvidenceProblem("Unknown evidence source or invalid event id");
    const fingerprint = hash([
      "contribute",
      command.subjectId,
      command.actor,
      [command.sourceId, command.eventId],
    ]);
    const idempotencyKey = hash(command.idempotencyKey);
    const eventId = eventKey(command.eventId);
    return this.options.store.transact(command.scope, command.challengeId, async (tx) => {
      const challenge = required(tx);
      const receipt = tx.receipts.find((item) => item.idempotencyKey === idempotencyKey);
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new ChallengeConflictProblem("Idempotency key reused with different input");
        return this.view(tx, command.subjectId, this.now());
      }
      const keyAttempt = tx.evidenceAttempts.find((item) => item.idempotencyKey === idempotencyKey);
      if (keyAttempt && keyAttempt.fingerprint !== fingerprint)
        throw new ChallengeConflictProblem("Idempotency key reused with different input");
      const attempt = tx.evidenceAttempts.find((item) => item.id === attemptKey(command));
      if (attempt) {
        if (attempt.fingerprint !== fingerprint || attempt.idempotencyKey !== idempotencyKey)
          throw new ChallengeConflictProblem("Event already registered");
        if (attempt.state === "rejected")
          throw new ChallengeEvidenceProblem("Evidence was rejected");
        if (attempt.state === "accepted")
          throw new ChallengeConflictProblem("Event already consumed");
        return null;
      }
      if (
        tx.erasedSubjectHashes.includes(hash(command.subjectId)) ||
        tx.erasedEventIds.includes(eventId) ||
        tx.contributions.some((item) => item.eventId === eventId)
      )
        throw new ChallengeConflictProblem("Event or subject cannot participate");
      const now = this.now();
      if (
        challenge.finalizedAt ||
        now.getTime() >= challenge.end.getTime() + challenge.lateAllowanceMs
      )
        throw new ChallengeConflictProblem("Contribution window is closed");
      if (!tx.members.some((item) => item.subjectId === command.subjectId))
        throw new ChallengeEvidenceProblem("Subject has not joined");
      tx.saveEvidenceAttempt({
        id: attemptKey(command),
        eventId,
        sourceId: command.sourceId,
        subjectId: command.subjectId,
        receivedAt: now,
        state: "unknown",
        idempotencyKey,
        fingerprint,
      });
      return null;
    });
  }
  async close(command: ChallengeCommand & { expectedVersion?: number }): Promise<ChallengeView> {
    command = structuredClone(command);
    return this.mutate(command, "close", command.expectedVersion ?? null, (tx, now) => {
      const challenge = required(tx);
      if (command.expectedVersion !== undefined && command.expectedVersion !== challenge.version)
        throw new ChallengeConflictProblem("Expected version must match");
      if (challenge.finalizedAt) return;
      if (now.getTime() < challenge.end.getTime() + challenge.lateAllowanceMs)
        throw new ChallengeConflictProblem("Settlement window is still open");
      if (tx.evidenceAttempts.some((item) => item.state === "unknown"))
        throw new ChallengeConflictProblem("Unresolved evidence prevents settlement");
      const aggregate = summarize(tx);
      const completed =
        aggregate.progress >= challenge.goal && aggregate.memberCount >= challenge.minMembers;
      tx.saveChallenge({
        ...challenge,
        ...aggregate,
        state: completed ? "completed" : "expired",
        finalizedAt: now,
      });
      if (completed)
        tx.saveCompletion({
          id: hash([scopeKey(challenge.scope), challenge.id, "completion"]),
          challengeId: challenge.id,
          definitionVersion: challenge.version,
          ...aggregate,
          completedAt: now,
        });
    });
  }
  async eraseSubject(command: ChallengeCommand): Promise<ChallengeView> {
    command = structuredClone(command);
    return this.mutate(command, "eraseSubject", null, (tx) => {
      const challenge = required(tx);
      const retained =
        challenge.leavePolicy === "retain" ? subjectProgress(tx, command.subjectId) : 0;
      tx.saveChallenge({
        ...challenge,
        erasedProgress: safeAdd(challenge.erasedProgress, retained),
      });
      tx.eraseSubject(command.subjectId, hash(command.subjectId));
    });
  }
  async read(
    access: ChallengeAccess & { participantOffset?: number; participantLimit?: number },
  ): Promise<ChallengeView> {
    access = structuredClone(access);
    await this.authorize(access, "read");
    const offset = access.participantOffset ?? 0;
    const limit = access.participantLimit ?? 20;
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new ChallengeInvalidProblem("Invalid participant page");
    return this.options.store.transact(access.scope, access.challengeId, async (tx) =>
      this.view(tx, access.subjectId, this.now(), offset, limit),
    );
  }
  private async authorize(access: ChallengeAccess, action: ChallengeAction): Promise<void> {
    assertChallengeScope(access.scope, access.challengeId);
    if (
      !nonempty(access.subjectId) ||
      !nonempty(access.actor?.id) ||
      !nonempty(access.actor?.reason)
    )
      throw new ChallengeInvalidProblem("Subject and audit actor are required");
    if (
      !(await this.options.authorize(structuredClone(access), action)) ||
      (action !== "eraseSubject" && !(await this.options.isMember(structuredClone(access))))
    )
      throw new ChallengeAccessDeniedProblem();
  }
  private now(): Date {
    const now = this.options.clock();
    if (!validDate(now)) throw new ChallengeInvalidProblem("Clock returned invalid time");
    return new Date(now);
  }
  private async mutate(
    command: ChallengeCommand,
    action: ChallengeAction,
    input: unknown,
    operation: (tx: ChallengeTransaction, now: Date) => void | Promise<void>,
  ): Promise<ChallengeView> {
    command = structuredClone(command);
    input = structuredClone(input);
    await this.authorize(command, action);
    if (!nonempty(command.idempotencyKey))
      throw new ChallengeInvalidProblem("Idempotency key is required");
    const fingerprint = hash([action, command.subjectId, command.actor, input]);
    return this.options.store.transact(command.scope, command.challengeId, async (tx) => {
      const now = this.now();
      const reserved = tx.evidenceAttempts.find(
        (item) => item.idempotencyKey === hash(command.idempotencyKey),
      );
      if (reserved && reserved.fingerprint !== fingerprint)
        throw new ChallengeConflictProblem("Idempotency key reused with different input");
      const previous = tx.receipts.find(
        (item) => item.idempotencyKey === hash(command.idempotencyKey),
      );
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new ChallengeConflictProblem("Idempotency key reused with different input");
        return this.view(tx, command.subjectId, now);
      }
      await operation(tx, now);
      const challenge = required(tx);
      if (!challenge.finalizedAt)
        tx.saveChallenge({
          ...challenge,
          ...summarize(tx),
          state: now < challenge.start ? "scheduled" : now < challenge.end ? "active" : "closing",
        });
      tx.saveReceipt({
        action,
        definitionVersion: challenge.version,
        idempotencyKey: hash(command.idempotencyKey),
        fingerprint,
        subjectHash: action === "eraseSubject" ? null : hash(command.subjectId),
        actor: action === "eraseSubject" ? "" : command.actor.id,
        reason: action === "eraseSubject" ? "" : command.actor.reason,
        recordedAt: now,
      });
      return this.view(tx, command.subjectId, now);
    });
  }
  private view(
    tx: ChallengeTransaction,
    subjectId: string,
    now: Date,
    offset = 0,
    limit = 20,
  ): ChallengeView {
    const stored = required(tx);
    const challenge = stored.finalizedAt
      ? stored
      : {
          ...stored,
          ...summarize(tx),
          state:
            now < stored.start
              ? ("scheduled" as const)
              : now < stored.end
                ? ("active" as const)
                : ("closing" as const),
        };
    const self = tx.members.find((item) => item.subjectId === subjectId) ?? null;
    const participants =
      challenge.visibility === "consented" && self !== null && active(self)
        ? tx.members
            .filter((item) => item.publicConsent && active(item))
            .sort((a, b) => a.subjectId.localeCompare(b.subjectId))
            .slice(offset, offset + limit)
            .map((item) => ({
              subjectId: item.subjectId,
              progress: subjectProgress(tx, item.subjectId),
            }))
        : [];
    return structuredClone({
      challenge,
      self,
      selfProgress: subjectProgress(tx, subjectId),
      pendingEvidenceCount: tx.evidenceAttempts.filter((item) => item.state === "unknown").length,
      participants,
    });
  }
}
function required(tx: ChallengeTransaction): Challenge {
  if (!tx.challenge) throw new ChallengeNotFoundProblem();
  return tx.challenge;
}
function active(member: ChallengeMember): boolean {
  return member.intervals.some((item) => item.leftAt === null);
}
function subjectProgress(tx: ChallengeTransaction, subjectId: string): number {
  const challenge = required(tx);
  const member = tx.members.find((item) => item.subjectId === subjectId);
  if (!member || (challenge.leavePolicy === "remove" && !active(member))) return 0;
  const currentInterval = member.intervals.find((item) => item.leftAt === null);
  const contributions = tx.contributions.filter(
    (item) =>
      item.subjectId === subjectId &&
      (challenge.leavePolicy === "retain" ||
        (currentInterval && item.occurredAt >= currentInterval.joinedAt)),
  );
  let total = 0;
  for (const original of contributions.filter((item) => item.correctionOf === null)) {
    const latest = contributions
      .filter((item) => item.correctionOf === original.eventId)
      .reduce((latest, item) => (item.revision > latest.revision ? item : latest), original);
    total = safeAdd(total, latest.amount);
  }
  return challenge.memberCap === null ? total : Math.min(total, challenge.memberCap);
}
function summarize(tx: ChallengeTransaction): { progress: number; memberCount: number } {
  let progress = required(tx).erasedProgress;
  for (const member of tx.members)
    progress = safeAdd(progress, subjectProgress(tx, member.subjectId));
  return { progress, memberCount: tx.members.filter(active).length };
}
function safeAdd(a: number, b: number): number {
  const result = a + b;
  if (!Number.isSafeInteger(result))
    throw new ChallengeInvalidProblem("Progress exceeds safe integer range");
  return result;
}
function scopeKey(scope: ChallengeAccess["scope"]): string {
  return JSON.stringify([scope.app, scope.environment, scope.tenantId]);
}
function hash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
function eventKey(eventId: string): string {
  return hash(eventId);
}

function canonical(value: unknown): unknown {
  if (value instanceof Date) {
    if (!validDate(value)) throw new ChallengeInvalidProblem("Invalid date");
    return value.toISOString();
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}

function snapshotDefinition(value: ChallengeDefinition): ChallengeDefinition {
  assertChallengeDefinition(value);
  return {
    id: value.id,
    version: value.version,
    scope: {
      app: value.scope.app,
      environment: value.scope.environment,
      tenantId: value.scope.tenantId,
    },
    start: value.start,
    end: value.end,
    goal: value.goal,
    memberCap: value.memberCap,
    minMembers: value.minMembers,
    lateAllowanceMs: value.lateAllowanceMs,
    visibility: value.visibility,
    leavePolicy: value.leavePolicy,
  };
}

function attemptKey(command: ChallengeCommand & { sourceId: string; eventId: string }): string {
  return hash([command.sourceId, command.subjectId, command.eventId]);
}
