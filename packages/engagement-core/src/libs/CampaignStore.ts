import { Problem, ProblemCategory } from "@croco/problems-core";

import type { EngagementDeliveryPolicy, EngagementSendResult } from "./EngagementService";
import type { RecipientRef } from "./RecipientContracts";

export type CampaignScopeRef =
  | Readonly<{ kind: "tenant"; tenantId: string }>
  | Readonly<{ kind: "global" }>;

export type CampaignSnapshotState = "building" | "complete" | "failed";

export type CampaignSnapshot = Readonly<{
  id: string;
  scope: CampaignScopeRef;
  audienceId: string;
  campaignId: string;
  campaignVersion: string;
  messageId: string;
  descriptorFingerprint: string;
  state: CampaignSnapshotState;
  memberCount: number;
  createdAt: Date;
  completedAt?: Date;
  failureCode?: string;
}>;

export type CampaignSnapshotValue =
  | Readonly<{ type: "null" }>
  | Readonly<{ type: "boolean"; value: boolean }>
  | Readonly<{ type: "number"; value: number }>
  | Readonly<{ type: "string"; value: string }>
  | Readonly<{ type: "date"; value: string }>
  | Readonly<{ type: "array"; value: readonly CampaignSnapshotValue[] }>
  | Readonly<{
      type: "object";
      value: readonly Readonly<{ key: string; value: CampaignSnapshotValue }>[];
    }>;

type CampaignSnapshotMemberIdentity = Readonly<{
  snapshotId: string;
  scope: CampaignScopeRef;
  ordinal: number;
  memberKey: string;
}>;

export type CampaignSnapshotMember =
  | (CampaignSnapshotMemberIdentity &
      Readonly<{
        state: "ready";
        recipient: RecipientRef;
        data: CampaignSnapshotValue;
        policy?: EngagementDeliveryPolicy;
      }>)
  | (CampaignSnapshotMemberIdentity &
      Readonly<{
        state: "mapping-failed";
        recipient?: RecipientRef;
        failureCode: string;
      }>);

export type CampaignMemberOutcomeStatus = "queued" | "suppressed" | "failed" | "skipped";

export type CampaignMemberOutcome = Readonly<{
  snapshotId: string;
  scope: CampaignScopeRef;
  memberKey: string;
  executionIds?: readonly string[];
  reason?: string;
  recordedAt: Date;
}> &
  (
    | Readonly<{
        status: "failed";
        failureCode: string;
        retryable: boolean;
      }>
    | Readonly<{
        status: Exclude<CampaignMemberOutcomeStatus, "failed">;
        failureCode?: never;
        retryable?: never;
      }>
  );

export type CampaignProgress = Readonly<{
  total: number;
  completed: number;
  queued: number;
  suppressed: number;
  failed: number;
  skipped: number;
  pending: number;
}>;

export type CreateCampaignSnapshotInput = Readonly<{
  id: string;
  scope: CampaignScopeRef;
  audienceId: string;
  campaignId: string;
  campaignVersion: string;
  messageId: string;
  descriptorFingerprint: string;
  createdAt: Date;
}>;

export type AppendCampaignSnapshotMembersInput = Readonly<{
  scope: CampaignScopeRef;
  snapshotId: string;
  expectedStartOrdinal: number;
  members: readonly CampaignSnapshotMember[];
}>;

export type CompleteCampaignSnapshotInput = Readonly<{
  scope: CampaignScopeRef;
  snapshotId: string;
  expectedMemberCount: number;
  completedAt: Date;
}>;

export type FailCampaignSnapshotInput = Readonly<{
  scope: CampaignScopeRef;
  snapshotId: string;
  failureCode: string;
  completedAt: Date;
}>;

export type CampaignSnapshotMemberPage = Readonly<{
  members: readonly CampaignSnapshotMember[];
  nextOrdinal?: number;
}>;

export type ListCampaignSnapshotMembersOptions = Readonly<{
  afterOrdinal?: number;
  limit: number;
}>;

export type RecordCampaignMemberOutcomeInput = CampaignMemberOutcome;

export interface CampaignStore {
  createSnapshot(input: CreateCampaignSnapshotInput): Promise<CampaignSnapshot>;
  appendSnapshotMembers(input: AppendCampaignSnapshotMembersInput): Promise<CampaignSnapshot>;
  completeSnapshot(input: CompleteCampaignSnapshotInput): Promise<CampaignSnapshot>;
  failSnapshot(input: FailCampaignSnapshotInput): Promise<CampaignSnapshot>;
  getSnapshot(scope: CampaignScopeRef, snapshotId: string): Promise<CampaignSnapshot | undefined>;
  listSnapshotMembers(
    scope: CampaignScopeRef,
    snapshotId: string,
    options: ListCampaignSnapshotMembersOptions,
  ): Promise<CampaignSnapshotMemberPage>;
  getMemberOutcome(
    scope: CampaignScopeRef,
    snapshotId: string,
    memberKey: string,
  ): Promise<CampaignMemberOutcome | undefined>;
  recordMemberOutcome(input: RecordCampaignMemberOutcomeInput): Promise<CampaignMemberOutcome>;
  summarizeSnapshot(scope: CampaignScopeRef, snapshotId: string): Promise<CampaignProgress>;
}

type StoredSnapshot = {
  snapshot: CampaignSnapshot;
  members: CampaignSnapshotMember[];
  memberKeys: Set<string>;
  outcomes: Map<string, CampaignMemberOutcome>;
};

export class InMemoryCampaignStore implements CampaignStore {
  private readonly snapshots = new Map<string, StoredSnapshot>();

  async createSnapshot(input: CreateCampaignSnapshotInput): Promise<CampaignSnapshot> {
    assertSnapshotInput(input);
    const storageKey = snapshotStorageKey(input.scope, input.id);
    if (this.snapshots.has(storageKey)) {
      throw new CampaignStoreConflictProblem("snapshot-already-exists", input.id);
    }

    const snapshot = freezeSnapshot({
      ...input,
      scope: cloneScope(input.scope),
      state: "building",
      memberCount: 0,
      createdAt: new Date(input.createdAt),
    });
    this.snapshots.set(storageKey, {
      snapshot,
      members: [],
      memberKeys: new Set(),
      outcomes: new Map(),
    });
    return cloneSnapshot(snapshot);
  }

  async appendSnapshotMembers(
    input: AppendCampaignSnapshotMembersInput,
  ): Promise<CampaignSnapshot> {
    const stored = this.requireStored(input.scope, input.snapshotId);
    if (stored.snapshot.state !== "building") {
      throw new CampaignStoreConflictProblem("snapshot-is-immutable", input.snapshotId);
    }
    if (input.expectedStartOrdinal !== stored.members.length) {
      throw new CampaignStoreConflictProblem("snapshot-append-position-mismatch", input.snapshotId);
    }

    const nextMembers: CampaignSnapshotMember[] = [];
    const nextKeys = new Set<string>();
    for (const [index, member] of input.members.entries()) {
      const expectedOrdinal = input.expectedStartOrdinal + index;
      assertSnapshotMember(member, stored.snapshot, expectedOrdinal);
      if (stored.memberKeys.has(member.memberKey) || nextKeys.has(member.memberKey)) {
        throw new CampaignStoreConflictProblem("duplicate-member-key", input.snapshotId);
      }
      nextKeys.add(member.memberKey);
      nextMembers.push(cloneMember(member));
    }

    stored.members.push(...nextMembers);
    for (const memberKey of nextKeys) stored.memberKeys.add(memberKey);
    stored.snapshot = freezeSnapshot({
      ...stored.snapshot,
      memberCount: stored.members.length,
    });
    return cloneSnapshot(stored.snapshot);
  }

  async completeSnapshot(input: CompleteCampaignSnapshotInput): Promise<CampaignSnapshot> {
    const stored = this.requireStored(input.scope, input.snapshotId);
    if (stored.snapshot.state !== "building") {
      throw new CampaignStoreConflictProblem("snapshot-cannot-complete", input.snapshotId);
    }
    if (input.expectedMemberCount !== stored.members.length) {
      throw new CampaignStoreConflictProblem("snapshot-member-count-mismatch", input.snapshotId);
    }
    stored.snapshot = freezeSnapshot({
      ...stored.snapshot,
      state: "complete",
      memberCount: stored.members.length,
      completedAt: new Date(input.completedAt),
    });
    return cloneSnapshot(stored.snapshot);
  }

  async failSnapshot(input: FailCampaignSnapshotInput): Promise<CampaignSnapshot> {
    const stored = this.requireStored(input.scope, input.snapshotId);
    if (stored.snapshot.state === "complete") {
      throw new CampaignStoreConflictProblem("completed-snapshot-cannot-fail", input.snapshotId);
    }
    if (stored.snapshot.state === "failed") return cloneSnapshot(stored.snapshot);
    stored.snapshot = freezeSnapshot({
      ...stored.snapshot,
      state: "failed",
      failureCode: input.failureCode,
      completedAt: new Date(input.completedAt),
    });
    return cloneSnapshot(stored.snapshot);
  }

  async getSnapshot(
    scope: CampaignScopeRef,
    snapshotId: string,
  ): Promise<CampaignSnapshot | undefined> {
    const stored = this.snapshots.get(snapshotStorageKey(scope, snapshotId));
    if (stored === undefined) return undefined;
    return cloneSnapshot(stored.snapshot);
  }

  async listSnapshotMembers(
    scope: CampaignScopeRef,
    snapshotId: string,
    options: ListCampaignSnapshotMembersOptions,
  ): Promise<CampaignSnapshotMemberPage> {
    assertPageLimit(options.limit);
    const stored = this.requireStored(scope, snapshotId);
    if (stored.snapshot.state !== "complete") {
      throw new CampaignSnapshotIncompleteProblem(snapshotId, stored.snapshot.state);
    }
    const start = options.afterOrdinal === undefined ? 0 : options.afterOrdinal + 1;
    if (!Number.isSafeInteger(start) || start < 0) {
      throw new CampaignStoreValidationProblem("afterOrdinal must be a non-negative integer");
    }
    const members = stored.members.slice(start, start + options.limit).map(cloneMember);
    const last = members.at(-1);
    return Object.freeze({
      members: Object.freeze(members),
      ...(last !== undefined && last.ordinal + 1 < stored.members.length
        ? { nextOrdinal: last.ordinal }
        : {}),
    });
  }

  async getMemberOutcome(
    scope: CampaignScopeRef,
    snapshotId: string,
    memberKey: string,
  ): Promise<CampaignMemberOutcome | undefined> {
    const stored = this.requireStored(scope, snapshotId);
    return cloneOutcome(stored.outcomes.get(memberKey));
  }

  async recordMemberOutcome(
    input: RecordCampaignMemberOutcomeInput,
  ): Promise<CampaignMemberOutcome> {
    const stored = this.requireStored(input.scope, input.snapshotId);
    if (stored.snapshot.state !== "complete") {
      throw new CampaignSnapshotIncompleteProblem(input.snapshotId, stored.snapshot.state);
    }
    if (!stored.memberKeys.has(input.memberKey)) {
      throw new CampaignStoreValidationProblem(
        `Snapshot ${input.snapshotId} does not contain the requested member`,
      );
    }
    assertOutcome(input);
    const existing = stored.outcomes.get(input.memberKey);
    if (
      existing !== undefined &&
      (existing.status !== "failed" ||
        !existing.retryable ||
        (input.status === "failed" && input.retryable))
    ) {
      return freezeOutcome(existing);
    }

    const outcome = freezeOutcome(input);
    stored.outcomes.set(input.memberKey, outcome);
    return freezeOutcome(outcome);
  }

  async summarizeSnapshot(scope: CampaignScopeRef, snapshotId: string): Promise<CampaignProgress> {
    const stored = this.requireStored(scope, snapshotId);
    const counts = { queued: 0, suppressed: 0, failed: 0, skipped: 0 };
    for (const outcome of stored.outcomes.values()) counts[outcome.status] += 1;
    const completed = counts.queued + counts.suppressed + counts.failed + counts.skipped;
    return Object.freeze({
      total: stored.snapshot.memberCount,
      completed,
      ...counts,
      pending: Math.max(0, stored.snapshot.memberCount - completed),
    });
  }

  private requireStored(scope: CampaignScopeRef, snapshotId: string): StoredSnapshot {
    const stored = this.snapshots.get(snapshotStorageKey(scope, snapshotId));
    if (stored === undefined) {
      throw new CampaignSnapshotNotFoundProblem(snapshotId, scope);
    }
    return stored;
  }
}

export function encodeCampaignSnapshotData(value: unknown): CampaignSnapshotValue {
  return encodeSnapshotValue(value, new WeakSet());
}

export function decodeCampaignSnapshotData(value: CampaignSnapshotValue): unknown {
  switch (value.type) {
    case "null":
      return null;
    case "boolean":
    case "number":
    case "string":
      return value.value;
    case "date": {
      const date = new Date(value.value);
      if (Number.isNaN(date.getTime()) || date.toISOString() !== value.value) {
        throw new CampaignSnapshotPayloadProblem("Snapshot contains an invalid date value");
      }
      return date;
    }
    case "array":
      return value.value.map(decodeCampaignSnapshotData);
    case "object":
      return Object.fromEntries(
        value.value.map((entry) => [entry.key, decodeCampaignSnapshotData(entry.value)]),
      );
  }
}

export function campaignScopeKey(scope: CampaignScopeRef): string {
  return scope.kind === "global" ? "global" : `tenant:${encodeURIComponent(scope.tenantId)}`;
}

export function campaignScopeForTenant(tenantId: string): CampaignScopeRef {
  if (tenantId.trim().length === 0) {
    throw new CampaignStoreValidationProblem("Campaign tenantId must not be empty");
  }
  return Object.freeze({ kind: "tenant", tenantId });
}

export function campaignOutcomeFromSendResult(
  input: Readonly<{
    scope: CampaignScopeRef;
    snapshotId: string;
    memberKey: string;
    result: EngagementSendResult;
    recordedAt: Date;
  }>,
): CampaignMemberOutcome {
  if (input.result.status === "queued") {
    return freezeOutcome({
      scope: input.scope,
      snapshotId: input.snapshotId,
      memberKey: input.memberKey,
      status: "queued",
      executionIds: input.result.executionIds,
      recordedAt: input.recordedAt,
    });
  }
  return freezeOutcome({
    scope: input.scope,
    snapshotId: input.snapshotId,
    memberKey: input.memberKey,
    status: "suppressed",
    reason: input.result.reason,
    recordedAt: input.recordedAt,
  });
}

export class CampaignStoreValidationProblem extends Problem {
  constructor(detail: string) {
    super("engagement-core/campaign-store-invalid", ProblemCategory.ValidationError, detail, {
      extensions: { retryable: false },
    });
  }
}

export class CampaignStoreConflictProblem extends Problem {
  constructor(reason: string, snapshotId: string, evidence: Readonly<Record<string, string>> = {}) {
    super(
      "engagement-core/campaign-store-conflict",
      ProblemCategory.Conflict,
      `Campaign snapshot ${snapshotId} rejected ${reason}`,
      { extensions: { reason, snapshotId, ...evidence, retryable: false } },
    );
  }
}

export class CampaignSnapshotNotFoundProblem extends Problem {
  constructor(snapshotId: string, scope: CampaignScopeRef) {
    super(
      "engagement-core/campaign-snapshot-not-found",
      ProblemCategory.NotFound,
      `Campaign snapshot ${snapshotId} was not found`,
      { extensions: { snapshotId, scopeKey: campaignScopeKey(scope), retryable: false } },
    );
  }
}

export class CampaignSnapshotIncompleteProblem extends Problem {
  constructor(snapshotId: string, state: CampaignSnapshotState) {
    super(
      "engagement-core/campaign-snapshot-incomplete",
      ProblemCategory.Conflict,
      `Campaign snapshot ${snapshotId} is ${state}`,
      { extensions: { snapshotId, state, retryable: false } },
    );
  }
}

export class CampaignSnapshotPayloadProblem extends Problem {
  constructor(detail: string) {
    super(
      "engagement-core/campaign-snapshot-payload-invalid",
      ProblemCategory.ValidationError,
      detail,
      {
        extensions: { retryable: false },
      },
    );
  }
}

function encodeSnapshotValue(value: unknown, ancestors: WeakSet<object>): CampaignSnapshotValue {
  if (value === null) return Object.freeze({ type: "null" });
  if (typeof value === "boolean") return Object.freeze({ type: "boolean", value });
  if (typeof value === "string") return Object.freeze({ type: "string", value });
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CampaignSnapshotPayloadProblem("Snapshot numbers must be finite");
    }
    return Object.freeze({ type: "number", value });
  }
  if (typeof value !== "object") {
    throw new CampaignSnapshotPayloadProblem(
      `Snapshot data cannot contain ${value === undefined ? "undefined" : typeof value}`,
    );
  }
  if (ancestors.has(value)) {
    throw new CampaignSnapshotPayloadProblem("Snapshot data cannot contain cycles");
  }
  ancestors.add(value);
  try {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new CampaignSnapshotPayloadProblem("Snapshot data cannot contain invalid dates");
      }
      return Object.freeze({ type: "date", value: value.toISOString() });
    }
    if (Array.isArray(value)) {
      return Object.freeze({
        type: "array",
        value: Object.freeze(value.map((entry) => encodeSnapshotValue(entry, ancestors))),
      });
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CampaignSnapshotPayloadProblem(
        "Snapshot data must contain only arrays, dates, and plain objects",
      );
    }
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => Object.freeze({ key, value: encodeSnapshotValue(record[key], ancestors) }));
    return Object.freeze({ type: "object", value: Object.freeze(entries) });
  } finally {
    ancestors.delete(value);
  }
}

function assertSnapshotInput(input: CreateCampaignSnapshotInput): void {
  for (const [name, value] of [
    ["snapshot id", input.id],
    ["audience id", input.audienceId],
    ["campaign id", input.campaignId],
    ["campaign version", input.campaignVersion],
    ["message id", input.messageId],
    ["descriptor fingerprint", input.descriptorFingerprint],
  ] as const) {
    if (value.trim().length === 0) {
      throw new CampaignStoreValidationProblem(`${name} must not be empty`);
    }
  }
  if (input.scope.kind === "tenant" && input.scope.tenantId.trim().length === 0) {
    throw new CampaignStoreValidationProblem("Campaign tenant scope must not be empty");
  }
  if (Number.isNaN(input.createdAt.getTime())) {
    throw new CampaignStoreValidationProblem("Campaign snapshot creation time is invalid");
  }
}

function assertSnapshotMember(
  member: CampaignSnapshotMember,
  snapshot: CampaignSnapshot,
  expectedOrdinal: number,
): void {
  if (member.snapshotId !== snapshot.id || !sameScope(member.scope, snapshot.scope)) {
    throw new CampaignStoreValidationProblem("Campaign snapshot member scope or id is invalid");
  }
  if (member.ordinal !== expectedOrdinal) {
    throw new CampaignStoreValidationProblem("Campaign snapshot member ordinal is not contiguous");
  }
  if (member.memberKey.trim().length === 0) {
    throw new CampaignStoreValidationProblem("Campaign snapshot member key must not be empty");
  }
  if (
    snapshot.scope.kind === "tenant" &&
    member.recipient !== undefined &&
    member.recipient.tenantId !== snapshot.scope.tenantId
  ) {
    throw new CampaignStoreValidationProblem("Campaign snapshot member crossed tenant scope");
  }
}

function assertOutcome(outcome: CampaignMemberOutcome): void {
  if (outcome.memberKey.trim().length === 0) {
    throw new CampaignStoreValidationProblem("Campaign outcome member key must not be empty");
  }
  if (Number.isNaN(outcome.recordedAt.getTime())) {
    throw new CampaignStoreValidationProblem("Campaign outcome time is invalid");
  }
  if (outcome.status === "failed") {
    if (outcome.failureCode.trim().length === 0) {
      throw new CampaignStoreValidationProblem("Campaign outcome failure code must not be empty");
    }
    if (typeof outcome.retryable !== "boolean") {
      throw new CampaignStoreValidationProblem("Campaign outcome retryable state must be explicit");
    }
  }
}

function assertPageLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new CampaignStoreValidationProblem("Campaign page limit must be a positive integer");
  }
}

function sameScope(left: CampaignScopeRef, right: CampaignScopeRef): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === "global" || (right.kind === "tenant" && left.tenantId === right.tenantId))
  );
}

function snapshotStorageKey(scope: CampaignScopeRef, snapshotId: string): string {
  return `${campaignScopeKey(scope)}:${encodeURIComponent(snapshotId)}`;
}

function cloneScope(scope: CampaignScopeRef): CampaignScopeRef {
  return scope.kind === "global"
    ? Object.freeze({ kind: "global" })
    : Object.freeze({ kind: "tenant", tenantId: scope.tenantId });
}

function freezeSnapshot(snapshot: CampaignSnapshot): CampaignSnapshot {
  return Object.freeze({
    ...snapshot,
    scope: cloneScope(snapshot.scope),
    createdAt: new Date(snapshot.createdAt),
    ...(snapshot.completedAt === undefined ? {} : { completedAt: new Date(snapshot.completedAt) }),
  });
}

function cloneSnapshot(snapshot: CampaignSnapshot): CampaignSnapshot {
  return freezeSnapshot(snapshot);
}

function cloneMember(member: CampaignSnapshotMember): CampaignSnapshotMember {
  const base = {
    snapshotId: member.snapshotId,
    scope: cloneScope(member.scope),
    ordinal: member.ordinal,
    memberKey: member.memberKey,
  };
  return member.state === "ready"
    ? Object.freeze({
        ...base,
        state: "ready",
        recipient: Object.freeze({ ...member.recipient }),
        data: cloneSnapshotValue(member.data),
        ...(member.policy === undefined ? {} : { policy: member.policy }),
      })
    : Object.freeze({
        ...base,
        state: "mapping-failed",
        ...(member.recipient === undefined
          ? {}
          : { recipient: Object.freeze({ ...member.recipient }) }),
        failureCode: member.failureCode,
      });
}

function cloneSnapshotValue(value: CampaignSnapshotValue): CampaignSnapshotValue {
  if (value.type === "array") {
    return Object.freeze({
      type: "array",
      value: Object.freeze(value.value.map(cloneSnapshotValue)),
    });
  }
  if (value.type === "object") {
    return Object.freeze({
      type: "object",
      value: Object.freeze(
        value.value.map((entry) =>
          Object.freeze({ key: entry.key, value: cloneSnapshotValue(entry.value) }),
        ),
      ),
    });
  }
  return Object.freeze({ ...value });
}

function freezeOutcome(outcome: CampaignMemberOutcome): CampaignMemberOutcome {
  return Object.freeze({
    ...outcome,
    scope: cloneScope(outcome.scope),
    ...(outcome.executionIds === undefined
      ? {}
      : { executionIds: Object.freeze([...outcome.executionIds]) }),
    recordedAt: new Date(outcome.recordedAt),
  });
}

function cloneOutcome(
  outcome: CampaignMemberOutcome | undefined,
): CampaignMemberOutcome | undefined {
  return outcome === undefined ? undefined : freezeOutcome(outcome);
}
