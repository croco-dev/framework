import type {
  PolicyActor,
  PolicyCommandReceipt,
  PolicyDefinitionRecord,
  PolicyPauseInput,
  PolicyPublicationInput,
  PolicyResolution,
  PolicyRevision,
  PolicyScheduleInput,
  PolicyScheduleRecord,
  PolicyScope,
} from "./Policy";

export type PolicyAuthorizationAction =
  | "read"
  | "create"
  | "edit"
  | "review"
  | "schedule"
  | "publish"
  | "pause"
  | "rollback";

export type PolicyAuditEntry = {
  readonly id: string;
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly action: PolicyAuthorizationAction;
  readonly revisionId?: string;
  readonly revision?: number;
  readonly actor: PolicyActor;
  readonly reason: string;
  readonly occurredAt: string;
};

export interface PolicyReleaseStore<TValue = unknown> {
  create(revision: PolicyRevision<TValue>, definition?: PolicyDefinitionRecord): Promise<void>;
  get(scope: PolicyScope, policyId: string): Promise<PolicyRevision<TValue> | null>;
  getRevision(
    scope: PolicyScope,
    policyId: string,
    revision: number,
  ): Promise<PolicyRevision<TValue> | null>;
  list(scope: PolicyScope, policyId: string): Promise<readonly PolicyRevision<TValue>[]>;
  save(
    revision: PolicyRevision<TValue>,
    expectedRevision: number,
    definition?: PolicyDefinitionRecord,
  ): Promise<void>;
  recordPause(input: PolicyPauseInput<TValue>): Promise<PolicyCommandReceipt>;
  recordPublication(input: PolicyPublicationInput<TValue>): Promise<PolicyCommandReceipt>;
  findCommandReceipt(
    scope: PolicyScope,
    policyId: string,
    idempotencyKey: string,
  ): Promise<PolicyCommandReceipt | null>;
  resolve(scope: PolicyScope, policyId: string, at: Date): Promise<PolicyResolution<TValue>>;
  schedule(input: PolicyScheduleInput): Promise<PolicyScheduleRecord>;
  attachScheduleExecution(
    scheduleId: string,
    executionId: string,
    triggerId?: string,
  ): Promise<PolicyScheduleRecord>;
  listDueSchedules(now: Date, limit?: number): Promise<readonly PolicyScheduleRecord[]>;
  claimSchedule(
    scheduleId: string,
    workerId: string,
    now: Date,
    leaseMs: number,
  ): Promise<PolicyScheduleRecord | null>;
  completeSchedule(scheduleId: string, now: Date): Promise<PolicyScheduleRecord>;
  failSchedule(scheduleId: string, now: Date, error: string): Promise<PolicyScheduleRecord>;
  cancelSchedule(scheduleId: string, now: Date, reason: string): Promise<PolicyScheduleRecord>;
  appendAudit?(entry: PolicyAuditEntry): Promise<void>;
  listAudit?(policyId: string, scope: PolicyScope): Promise<readonly PolicyAuditEntry[]>;
}

export interface PolicyScheduleLookup<TValue = unknown> extends PolicyReleaseStore<TValue> {
  getSchedule(scheduleId: string): Promise<PolicyScheduleRecord | null>;
}
