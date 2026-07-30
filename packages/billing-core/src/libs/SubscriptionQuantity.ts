import { createHash } from "node:crypto";
import { DomainEvent } from "@croco/events-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { recordError, recordEvent, withSpan } from "@croco/telemetry-api";
import type { PlanVersionDefinition, PlanVersionRef, SubscriptionQuantityPolicy } from "../types";
import type { PlanRegistry } from "./PlanRegistry";
import {
  InvalidSubscriptionQuantityProblem,
  ProviderCapabilityUnavailableProblem,
  SubscriptionQuantityReconciliationConflictProblem,
  SubscriptionQuantityReconciliationFailedProblem,
  SubscriptionQuantityProviderMismatchProblem,
  SubscriptionQuantityProviderSourceAheadProblem,
  SubscriptionQuantitySourceMismatchProblem,
  UnknownPlanVersionProblem,
} from "./problems/BillingProblems";

export type SubscriptionQuantitySourceInput = {
  readonly tenantId: string;
  readonly planVersion: PlanVersionDefinition;
};

export type SubscriptionQuantitySourceSnapshot = {
  readonly planVersionRef: PlanVersionRef;
  readonly sourceVersion: number;
  readonly activeMembershipCount: number;
  readonly billableMembershipCount: number;
  readonly entitlementSeatQuota: number;
  readonly evidence: Readonly<Record<string, string | number | boolean>>;
};

export interface SubscriptionQuantitySource {
  getSnapshot(input: SubscriptionQuantitySourceInput): Promise<SubscriptionQuantitySourceSnapshot>;
}

export type LicensedQuantityObservation = {
  readonly quantity: number;
  readonly providerVersion?: string;
};

export type SetLicensedQuantityInput = {
  readonly externalSubscriptionId: string;
  readonly quantity: number;
  readonly reconciliationId: string;
  readonly operationId: string;
  readonly sourceVersion: number;
};

export type SetLicensedQuantityResult =
  | {
      readonly status: "applied" | "duplicate";
      readonly observation: LicensedQuantityObservation;
    }
  | {
      readonly status: "stale";
      readonly observation: LicensedQuantityObservation;
      readonly acceptedSourceVersion: number;
    };

export interface LicensedQuantityGateway {
  getQuantity(externalSubscriptionId: string): Promise<LicensedQuantityObservation>;
  /**
   * Applies one logical quantity update idempotently.
   *
   * Implementations must return `duplicate` for a replayed operation identity and `stale` without
   * mutating provider state when a newer source version was already accepted. A reconciliation can
   * use a new operation identity after observing new provider-side drift.
   */
  setQuantity(input: SetLicensedQuantityInput): Promise<SetLicensedQuantityResult>;
}

export type SubscriptionQuantityReconciliationState =
  | "pending"
  | "drifted"
  | "in_sync"
  | "retryable_failed"
  | "terminal_failed"
  | "unsupported"
  | "superseded";

export type SubscriptionQuantityFailureEvidence = {
  readonly code: string;
  readonly detail: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly occurredAt: Date;
};

export type SubscriptionQuantitySnapshot = {
  readonly reconciliationId: string;
  readonly tenantId: string;
  readonly subscriptionId: string;
  readonly externalSubscriptionId: string;
  readonly planVersionRef: PlanVersionRef;
  readonly sourceVersion: number;
  readonly sourceEvidence: Readonly<Record<string, string | number | boolean>>;
  readonly activeMembershipCount: number;
  readonly billableMembershipCount: number;
  readonly entitlementSeatQuota: number;
  readonly desiredQuantity: number;
  readonly providerQuantity: number | null;
  readonly providerVersion?: string;
  readonly providerOperationId?: string;
  readonly providerAcceptedSourceVersion?: number;
  readonly state: SubscriptionQuantityReconciliationState;
  readonly reason: string;
  readonly revision: number;
  readonly attemptCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastAttemptAt?: Date;
  readonly lastSuccessAt?: Date;
  readonly lastFailure?: SubscriptionQuantityFailureEvidence;
};

export type SubscriptionQuantityDiagnostics = {
  readonly drifted: number;
  readonly pending: number;
  readonly sourceMismatches: number;
  readonly providerMismatches: number;
  readonly retryExhausted: number;
  readonly unsupported: number;
  readonly oldestPendingAt: Date | null;
  readonly truncated: boolean;
};

export type CreateSubscriptionQuantityIntent = Omit<
  SubscriptionQuantitySnapshot,
  | "providerQuantity"
  | "state"
  | "revision"
  | "attemptCount"
  | "createdAt"
  | "updatedAt"
  | "lastAttemptAt"
  | "lastSuccessAt"
  | "lastFailure"
  | "providerOperationId"
  | "providerAcceptedSourceVersion"
>;

export interface SubscriptionQuantityReconciliationStore {
  createOrSupersede(
    intent: CreateSubscriptionQuantityIntent,
  ): Promise<SubscriptionQuantitySnapshot>;
  saveIfCurrent(
    snapshot: SubscriptionQuantitySnapshot,
  ): Promise<SubscriptionQuantitySnapshot | null>;
  findCurrent(
    tenantId: string,
    externalSubscriptionId: string,
  ): Promise<SubscriptionQuantitySnapshot | null>;
  listRepairable(limit: number): Promise<SubscriptionQuantitySnapshot[]>;
  listRecent(limit: number): Promise<SubscriptionQuantitySnapshot[]>;
  getDiagnostics(options: {
    readonly maxAttempts: number;
    readonly sampleLimit: number;
  }): Promise<SubscriptionQuantityDiagnostics>;
}

export class InMemorySubscriptionQuantityReconciliationStore implements SubscriptionQuantityReconciliationStore {
  private readonly snapshots = new Map<string, SubscriptionQuantitySnapshot>();
  private readonly currentBySubscription = new Map<string, string>();

  constructor(private readonly clock: () => Date = () => new Date()) {}

  async createOrSupersede(
    intent: CreateSubscriptionQuantityIntent,
  ): Promise<SubscriptionQuantitySnapshot> {
    const key = subscriptionKey(intent.tenantId, intent.externalSubscriptionId);
    const currentId = this.currentBySubscription.get(key);
    const current = currentId ? this.snapshots.get(currentId) : undefined;

    if (current) {
      if (intent.sourceVersion < current.sourceVersion) {
        return cloneSnapshot(current);
      }
      if (intent.sourceVersion === current.sourceVersion) {
        if (intent.reconciliationId !== current.reconciliationId) {
          throw new SubscriptionQuantityReconciliationConflictProblem(
            intent.externalSubscriptionId,
            intent.sourceVersion,
          );
        }
        return cloneSnapshot(current);
      }

      this.snapshots.set(
        current.reconciliationId,
        freezeSnapshot({
          ...current,
          state: "superseded",
          revision: current.revision + 1,
          updatedAt: this.clock(),
        }),
      );
    }

    const now = this.clock();
    const snapshot = freezeSnapshot({
      ...intent,
      providerQuantity: null,
      state: "pending",
      revision: 0,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    this.snapshots.set(snapshot.reconciliationId, snapshot);
    this.currentBySubscription.set(key, snapshot.reconciliationId);
    return cloneSnapshot(snapshot);
  }

  async saveIfCurrent(
    snapshot: SubscriptionQuantitySnapshot,
  ): Promise<SubscriptionQuantitySnapshot | null> {
    const key = subscriptionKey(snapshot.tenantId, snapshot.externalSubscriptionId);
    if (this.currentBySubscription.get(key) !== snapshot.reconciliationId) {
      return null;
    }

    const current = this.snapshots.get(snapshot.reconciliationId);
    if (!current || current.revision !== snapshot.revision) {
      return null;
    }

    const stored = freezeSnapshot({
      ...snapshot,
      revision: snapshot.revision + 1,
      updatedAt: this.clock(),
    });
    this.snapshots.set(stored.reconciliationId, stored);
    return cloneSnapshot(stored);
  }

  async findCurrent(
    tenantId: string,
    externalSubscriptionId: string,
  ): Promise<SubscriptionQuantitySnapshot | null> {
    const id = this.currentBySubscription.get(subscriptionKey(tenantId, externalSubscriptionId));
    const snapshot = id ? this.snapshots.get(id) : undefined;
    return snapshot ? cloneSnapshot(snapshot) : null;
  }

  async listRepairable(limit: number): Promise<SubscriptionQuantitySnapshot[]> {
    ensureRepairLimit(limit);
    return [...this.currentBySubscription.values()]
      .map((id) => this.snapshots.get(id))
      .filter(
        (snapshot): snapshot is SubscriptionQuantitySnapshot =>
          snapshot !== undefined &&
          (snapshot.state === "pending" ||
            snapshot.state === "drifted" ||
            snapshot.state === "retryable_failed"),
      )
      .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime())
      .slice(0, limit)
      .map(cloneSnapshot);
  }

  async listRecent(limit: number): Promise<SubscriptionQuantitySnapshot[]> {
    ensureRepairLimit(limit);
    return [...this.currentBySubscription.values()]
      .map((id) => this.snapshots.get(id))
      .filter((snapshot): snapshot is SubscriptionQuantitySnapshot => snapshot !== undefined)
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .slice(0, limit)
      .map(cloneSnapshot);
  }

  async getDiagnostics(options: {
    readonly maxAttempts: number;
    readonly sampleLimit: number;
  }): Promise<SubscriptionQuantityDiagnostics> {
    ensureRepairLimit(options.sampleLimit);
    const snapshots = [...this.currentBySubscription.values()]
      .map((id) => this.snapshots.get(id))
      .filter((snapshot): snapshot is SubscriptionQuantitySnapshot => snapshot !== undefined);
    return aggregateDiagnostics(snapshots, options.maxAttempts, false);
  }
}

export type SubscriptionQuantityReconciliationEventPublisher = {
  publishNow(event: DomainEvent): Promise<void>;
};

export interface SubscriptionQuantityRepairSource {
  /**
   * Returns the next bounded page from the durable subscription inventory.
   *
   * Implementations own the scan cursor so repeated calls eventually cover in-sync subscriptions
   * as well as subscriptions whose first membership event was missed.
   */
  listCandidates(limit: number): Promise<readonly ReconcileSubscriptionQuantityInput[]>;
}

export type SubscriptionQuantityReconcilerDependencies = {
  readonly source: SubscriptionQuantitySource;
  readonly gateway: LicensedQuantityGateway;
  readonly store: SubscriptionQuantityReconciliationStore;
  readonly planRegistry: PlanRegistry;
  readonly eventPublisher?: SubscriptionQuantityReconciliationEventPublisher;
  readonly repairSource?: SubscriptionQuantityRepairSource;
  readonly clock?: () => Date;
  readonly maxAttempts?: number;
};

export type ReconcileSubscriptionQuantityInput = {
  readonly tenantId: string;
  readonly subscriptionId: string;
  readonly externalSubscriptionId?: string;
  readonly planVersionRef: PlanVersionRef;
  readonly reason: string;
};

export type ReconcileSubscriptionQuantitiesResult = {
  readonly requested: number;
  readonly inSync: number;
  readonly failed: number;
  readonly superseded: number;
};

export class SubscriptionQuantityReconciler {
  private readonly clock: () => Date;
  private readonly maxAttempts: number;

  constructor(private readonly dependencies: SubscriptionQuantityReconcilerDependencies) {
    this.clock = dependencies.clock ?? (() => new Date());
    this.maxAttempts = dependencies.maxAttempts ?? 5;
    if (!Number.isSafeInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 100) {
      throw new InvalidSubscriptionQuantityProblem(
        "max attempts must be a safe integer between 1 and 100",
      );
    }
  }

  async reconcile(
    input: ReconcileSubscriptionQuantityInput,
  ): Promise<SubscriptionQuantitySnapshot> {
    return withSpan(() => this.reconcileWithinSpan(input), {
      name: "billing.subscription_quantity.reconcile",
      attributes: {
        "billing.tenant_id": input.tenantId,
        "billing.subscription_id": input.subscriptionId,
        "billing.plan_version_ref": input.planVersionRef,
      },
    });
  }

  async createIntent(
    input: ReconcileSubscriptionQuantityInput,
  ): Promise<SubscriptionQuantitySnapshot> {
    return withSpan(async () => (await this.prepareIntentWithinSpan(input)).snapshot, {
      name: "billing.subscription_quantity.create_intent",
      attributes: {
        "billing.tenant_id": input.tenantId,
        "billing.subscription_id": input.subscriptionId,
        "billing.plan_version_ref": input.planVersionRef,
      },
    });
  }

  async repair(limit: number): Promise<ReconcileSubscriptionQuantitiesResult> {
    ensureRepairLimit(limit);
    const pending = await this.dependencies.store.listRepairable(limit);
    const work: Array<{
      readonly input: ReconcileSubscriptionQuantityInput;
      readonly snapshot?: SubscriptionQuantitySnapshot;
    }> = pending.map((snapshot) => ({
      input: {
        tenantId: snapshot.tenantId,
        subscriptionId: snapshot.subscriptionId,
        externalSubscriptionId: snapshot.externalSubscriptionId,
        planVersionRef: snapshot.planVersionRef,
        reason: "periodic.repair",
      },
      snapshot,
    }));
    const seen = new Set(
      pending.map(({ tenantId, externalSubscriptionId }) =>
        subscriptionKey(tenantId, externalSubscriptionId),
      ),
    );
    if (this.dependencies.repairSource && work.length < limit) {
      try {
        const candidates = await this.dependencies.repairSource.listCandidates(limit - work.length);
        for (const candidate of candidates) {
          if (work.length >= limit) break;
          const externalSubscriptionId =
            candidate.externalSubscriptionId ?? candidate.subscriptionId;
          const key = subscriptionKey(candidate.tenantId, externalSubscriptionId);
          if (seen.has(key)) continue;
          seen.add(key);
          work.push({
            input: { ...candidate, reason: "periodic.repair" },
          });
        }
      } catch (error) {
        recordError(
          error instanceof Problem
            ? error
            : new SubscriptionQuantityReconciliationFailedProblem(
                "subscription-inventory",
                error instanceof Error ? error : undefined,
              ),
        );
      }
    }
    let inSync = 0;
    let failed = 0;
    let superseded = 0;

    for (const item of work) {
      try {
        const result = await this.reconcile(item.input);
        if (result.state === "in_sync") inSync += 1;
        else if (result.state === "superseded") superseded += 1;
        else failed += 1;
      } catch (error) {
        const current = await this.dependencies.store.findCurrent(
          item.input.tenantId,
          item.input.externalSubscriptionId ?? item.input.subscriptionId,
        );
        if (current) {
          await this.fail(current, error, this.clock());
        } else {
          recordError(
            error instanceof Problem
              ? error
              : new SubscriptionQuantityReconciliationFailedProblem(
                  item.input.externalSubscriptionId ?? item.input.subscriptionId,
                  error instanceof Error ? error : undefined,
                ),
          );
        }
        failed += 1;
      }
    }

    return { requested: work.length, inSync, failed, superseded };
  }

  async getDiagnostics(limit = 100): Promise<SubscriptionQuantityDiagnostics> {
    ensureRepairLimit(limit);
    return this.dependencies.store.getDiagnostics({
      maxAttempts: this.maxAttempts,
      sampleLimit: limit,
    });
  }

  private async reconcileWithinSpan(
    input: ReconcileSubscriptionQuantityInput,
  ): Promise<SubscriptionQuantitySnapshot> {
    const prepared = await this.prepareIntentWithinSpan(input);
    let snapshot = prepared.snapshot;
    const externalSubscriptionId = snapshot.externalSubscriptionId;
    const desiredQuantity = snapshot.desiredQuantity;
    const reconciliationId = snapshot.reconciliationId;

    if (
      snapshot.reconciliationId !== prepared.reconciliationId ||
      snapshot.state === "superseded" ||
      snapshot.state === "terminal_failed" ||
      snapshot.state === "unsupported"
    ) {
      return snapshot;
    }
    if (snapshot.state === "in_sync" && input.reason !== "periodic.repair") {
      return snapshot;
    }

    const attemptedAt = this.clock();
    try {
      const observed = await this.dependencies.gateway.getQuantity(externalSubscriptionId);
      if (snapshot.state === "in_sync" && observed.quantity === desiredQuantity) {
        return snapshot;
      }
      if (observed.quantity === desiredQuantity) {
        return await this.complete(snapshot, observed, attemptedAt, false);
      }

      const providerOperationId =
        (snapshot.state === "drifted" || snapshot.state === "retryable_failed") &&
        snapshot.providerOperationId &&
        snapshot.lastFailure?.code !== "billing/subscription-quantity-provider-mismatch"
          ? snapshot.providerOperationId
          : `${reconciliationId}:${snapshot.revision + 1}`;
      const drifted = await this.dependencies.store.saveIfCurrent({
        ...snapshot,
        providerQuantity: observed.quantity,
        providerVersion: observed.providerVersion,
        providerOperationId,
        state: "drifted",
        attemptCount: snapshot.state === "in_sync" ? 1 : snapshot.attemptCount + 1,
        lastAttemptAt: attemptedAt,
        lastFailure: undefined,
      });
      if (!drifted) {
        return (
          (await this.dependencies.store.findCurrent(input.tenantId, externalSubscriptionId)) ??
          snapshot
        );
      }
      snapshot = drifted;
      if (snapshot.state !== "drifted") {
        return snapshot;
      }

      await this.publish(
        new SubscriptionQuantityDriftDetectedEvent(
          input.tenantId,
          externalSubscriptionId,
          desiredQuantity,
          observed.quantity,
          input.planVersionRef,
        ),
      );
      const result = await this.dependencies.gateway.setQuantity({
        externalSubscriptionId,
        quantity: desiredQuantity,
        reconciliationId,
        operationId: providerOperationId,
        sourceVersion: snapshot.sourceVersion,
      });
      if (result.status === "stale") {
        const current = await this.dependencies.store.findCurrent(
          input.tenantId,
          externalSubscriptionId,
        );
        if (current && current.reconciliationId !== snapshot.reconciliationId) {
          return current;
        }
        return this.fail(
          {
            ...snapshot,
            providerQuantity: result.observation.quantity,
            providerVersion: result.observation.providerVersion,
            providerAcceptedSourceVersion: result.acceptedSourceVersion,
          },
          new SubscriptionQuantityProviderSourceAheadProblem(
            externalSubscriptionId,
            snapshot.sourceVersion,
            result.acceptedSourceVersion,
          ),
          attemptedAt,
        );
      }
      if (result.observation.quantity !== desiredQuantity) {
        return await this.fail(
          {
            ...snapshot,
            providerQuantity: result.observation.quantity,
            providerVersion: result.observation.providerVersion,
          },
          new SubscriptionQuantityProviderMismatchProblem(
            externalSubscriptionId,
            desiredQuantity,
            result.observation.quantity,
          ),
          attemptedAt,
        );
      }
      return await this.complete(snapshot, result.observation, attemptedAt, true);
    } catch (error) {
      return await this.fail(snapshot, error, attemptedAt);
    }
  }

  private async prepareIntentWithinSpan(input: ReconcileSubscriptionQuantityInput): Promise<{
    readonly snapshot: SubscriptionQuantitySnapshot;
    readonly reconciliationId: string;
  }> {
    const planVersion = await this.dependencies.planRegistry.getPlanVersion(input.planVersionRef);
    if (!planVersion) {
      throw new UnknownPlanVersionProblem(input.planVersionRef);
    }

    const source = await this.dependencies.source.getSnapshot({
      tenantId: input.tenantId,
      planVersion,
    });
    validateSourceSnapshot(source, planVersion);
    const desiredQuantity = calculateDesiredQuantity(
      planVersion.quantityPolicy,
      source.billableMembershipCount,
    );
    const externalSubscriptionId = input.externalSubscriptionId ?? input.subscriptionId;
    const reconciliationId = createSubscriptionQuantityReconciliationId({
      tenantId: input.tenantId,
      externalSubscriptionId,
      planVersionRef: input.planVersionRef,
      desiredQuantity,
      sourceVersion: source.sourceVersion,
    });
    const snapshot = await this.dependencies.store.createOrSupersede({
      reconciliationId,
      tenantId: input.tenantId,
      subscriptionId: input.subscriptionId,
      externalSubscriptionId,
      planVersionRef: input.planVersionRef,
      sourceVersion: source.sourceVersion,
      sourceEvidence: source.evidence,
      activeMembershipCount: source.activeMembershipCount,
      billableMembershipCount: source.billableMembershipCount,
      entitlementSeatQuota: source.entitlementSeatQuota,
      desiredQuantity,
      reason: input.reason,
    });
    return { snapshot, reconciliationId };
  }

  private async complete(
    snapshot: SubscriptionQuantitySnapshot,
    observation: LicensedQuantityObservation,
    attemptedAt: Date,
    recoveredDrift: boolean,
  ): Promise<SubscriptionQuantitySnapshot> {
    const completed = await this.dependencies.store.saveIfCurrent({
      ...snapshot,
      providerQuantity: observation.quantity,
      providerVersion: observation.providerVersion,
      state: "in_sync",
      attemptCount: recoveredDrift ? snapshot.attemptCount : snapshot.attemptCount + 1,
      lastAttemptAt: attemptedAt,
      lastSuccessAt: this.clock(),
      lastFailure: undefined,
    });
    if (!completed) {
      return (
        (await this.dependencies.store.findCurrent(
          snapshot.tenantId,
          snapshot.externalSubscriptionId,
        )) ?? snapshot
      );
    }

    recordEvent("billing.subscription_quantity.reconciliation_succeeded", {
      "billing.reconciliation_id": completed.reconciliationId,
      "billing.quantity": completed.desiredQuantity,
    });
    await this.publish(
      new SubscriptionQuantityReconciliationSucceededEvent(
        completed.tenantId,
        completed.externalSubscriptionId,
        completed.desiredQuantity,
        completed.planVersionRef,
      ),
    );
    if (recoveredDrift) {
      await this.publish(
        new SubscriptionQuantityDriftRecoveredEvent(
          completed.tenantId,
          completed.externalSubscriptionId,
          completed.desiredQuantity,
          completed.planVersionRef,
        ),
      );
    }
    return completed;
  }

  private async fail(
    snapshot: SubscriptionQuantitySnapshot,
    error: unknown,
    attemptedAt: Date,
  ): Promise<SubscriptionQuantitySnapshot> {
    const problem =
      error instanceof Problem
        ? error
        : new SubscriptionQuantityReconciliationFailedProblem(
            snapshot.externalSubscriptionId,
            error instanceof Error ? error : undefined,
          );
    const unsupported = problem instanceof ProviderCapabilityUnavailableProblem;
    const retryable =
      !unsupported &&
      (problem.status === 408 ||
        problem.category === ProblemCategory.TooManyRequests ||
        problem.status >= 500);
    const attemptCount =
      snapshot.state === "drifted"
        ? snapshot.attemptCount
        : snapshot.state === "in_sync"
          ? 1
          : snapshot.attemptCount + 1;
    const retryExhausted = retryable && attemptCount >= this.maxAttempts;
    const failure: SubscriptionQuantityFailureEvidence = {
      code: problem.code,
      detail: problem.detail ?? problem.message,
      status: problem.status,
      retryable,
      occurredAt: attemptedAt,
    };
    const failed = await this.dependencies.store.saveIfCurrent({
      ...snapshot,
      state: unsupported
        ? "unsupported"
        : retryable && !retryExhausted
          ? "retryable_failed"
          : "terminal_failed",
      attemptCount,
      lastAttemptAt: attemptedAt,
      lastFailure: failure,
    });
    if (!failed) {
      const current = await this.dependencies.store.findCurrent(
        snapshot.tenantId,
        snapshot.externalSubscriptionId,
      );
      recordError(problem);
      recordEvent("billing.subscription_quantity.failure_persistence_conflict", {
        "billing.reconciliation_id": snapshot.reconciliationId,
        "billing.problem_code": problem.code,
      });
      return current ?? snapshot;
    }

    recordError(problem);
    recordEvent("billing.subscription_quantity.reconciliation_failed", {
      "billing.reconciliation_id": snapshot.reconciliationId,
      "billing.problem_code": problem.code,
      "billing.retryable": retryable,
    });
    await this.publish(
      new SubscriptionQuantityReconciliationFailedEvent(
        snapshot.tenantId,
        snapshot.externalSubscriptionId,
        snapshot.desiredQuantity,
        problem.code,
        retryable,
        snapshot.planVersionRef,
      ),
    );
    return failed;
  }

  private async publish(event: DomainEvent): Promise<void> {
    try {
      if (!this.dependencies.eventPublisher) return;
      await this.dependencies.eventPublisher.publishNow(event);
    } catch (error) {
      const problem =
        error instanceof Problem
          ? error
          : new SubscriptionQuantityReconciliationFailedProblem(
              "reconciliation-event-publication",
              error instanceof Error ? error : undefined,
            );
      recordError(problem);
      recordEvent("billing.subscription_quantity.event_publication_failed", {
        "billing.event_name": event.eventName,
        "billing.problem_code": problem.code,
      });
    }
  }
}

export function calculateDesiredQuantity(
  policy: SubscriptionQuantityPolicy,
  billableMembershipCount: number,
): number {
  ensureQuantity(billableMembershipCount, "billable membership count");
  const purchasedSeats = Math.max(0, billableMembershipCount - policy.includedSeats);
  return Math.max(policy.minimumQuantity, purchasedSeats);
}

export function createSubscriptionQuantityReconciliationId(input: {
  readonly tenantId: string;
  readonly externalSubscriptionId: string;
  readonly planVersionRef: PlanVersionRef;
  readonly desiredQuantity: number;
  readonly sourceVersion: number;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.tenantId,
        input.externalSubscriptionId,
        input.planVersionRef,
        input.desiredQuantity,
        input.sourceVersion,
      ]),
    )
    .digest("hex");
}

export class SubscriptionQuantityDriftDetectedEvent extends DomainEvent {
  static readonly eventName = "billing.subscription_quantity.drift_detected";
  constructor(
    readonly tenantId: string,
    readonly externalSubscriptionId: string,
    readonly desiredQuantity: number,
    readonly providerQuantity: number,
    readonly planVersionRef: PlanVersionRef,
  ) {
    super();
  }
}

export class SubscriptionQuantityReconciliationSucceededEvent extends DomainEvent {
  static readonly eventName = "billing.subscription_quantity.reconciliation_succeeded";
  constructor(
    readonly tenantId: string,
    readonly externalSubscriptionId: string,
    readonly quantity: number,
    readonly planVersionRef: PlanVersionRef,
  ) {
    super();
  }
}

export class SubscriptionQuantityReconciliationFailedEvent extends DomainEvent {
  static readonly eventName = "billing.subscription_quantity.reconciliation_failed";
  constructor(
    readonly tenantId: string,
    readonly externalSubscriptionId: string,
    readonly desiredQuantity: number,
    readonly problemCode: string,
    readonly retryable: boolean,
    readonly planVersionRef: PlanVersionRef,
  ) {
    super();
  }
}

export class SubscriptionQuantityDriftRecoveredEvent extends DomainEvent {
  static readonly eventName = "billing.subscription_quantity.drift_recovered";
  constructor(
    readonly tenantId: string,
    readonly externalSubscriptionId: string,
    readonly quantity: number,
    readonly planVersionRef: PlanVersionRef,
  ) {
    super();
  }
}

function validateSourceSnapshot(
  snapshot: SubscriptionQuantitySourceSnapshot,
  planVersion: PlanVersionDefinition,
): void {
  if (
    snapshot.planVersionRef !== planVersion.ref ||
    snapshot.entitlementSeatQuota !== planVersion.quantityPolicy.seatQuota
  ) {
    throw new SubscriptionQuantitySourceMismatchProblem(
      planVersion.ref,
      snapshot.planVersionRef,
      planVersion.quantityPolicy.seatQuota,
      snapshot.entitlementSeatQuota,
    );
  }
  ensureQuantity(snapshot.sourceVersion, "source version");
  ensureQuantity(snapshot.activeMembershipCount, "active membership count");
  ensureQuantity(snapshot.billableMembershipCount, "billable membership count");
  ensureQuantity(snapshot.entitlementSeatQuota, "entitlement seat quota");
  if (snapshot.billableMembershipCount > snapshot.activeMembershipCount) {
    throw new InvalidSubscriptionQuantityProblem(
      "billable membership count cannot exceed active membership count",
    );
  }
}

function ensureQuantity(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidSubscriptionQuantityProblem(`${field} must be a non-negative safe integer`);
  }
}

function ensureRepairLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw new InvalidSubscriptionQuantityProblem(
      "repair limit must be a safe integer between 1 and 1000",
    );
  }
}

function aggregateDiagnostics(
  snapshots: readonly SubscriptionQuantitySnapshot[],
  maxAttempts: number,
  truncated: boolean,
): SubscriptionQuantityDiagnostics {
  return {
    drifted: snapshots.filter(({ state }) => state === "drifted").length,
    pending: snapshots.filter(({ state }) => state === "pending").length,
    sourceMismatches: snapshots.filter(
      ({ lastFailure }) => lastFailure?.code === "billing/subscription-quantity-source-mismatch",
    ).length,
    providerMismatches: snapshots.filter(
      ({ lastFailure }) =>
        lastFailure?.code === "billing/subscription-quantity-provider-mismatch" ||
        lastFailure?.code === "billing/subscription-quantity-provider-source-ahead",
    ).length,
    retryExhausted: snapshots.filter(
      ({ state, lastFailure, attemptCount }) =>
        state === "terminal_failed" &&
        lastFailure?.retryable === true &&
        attemptCount >= maxAttempts,
    ).length,
    unsupported: snapshots.filter(({ state }) => state === "unsupported").length,
    oldestPendingAt:
      snapshots
        .filter(({ state }) => state === "pending" || state === "drifted")
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0]
        ?.createdAt ?? null,
    truncated,
  };
}

function subscriptionKey(tenantId: string, externalSubscriptionId: string): string {
  return JSON.stringify([tenantId, externalSubscriptionId]);
}

function freezeSnapshot(snapshot: SubscriptionQuantitySnapshot): SubscriptionQuantitySnapshot {
  return Object.freeze({
    ...snapshot,
    sourceEvidence: Object.freeze({ ...snapshot.sourceEvidence }),
    ...(snapshot.lastFailure
      ? {
          lastFailure: Object.freeze({
            ...snapshot.lastFailure,
            occurredAt: new Date(snapshot.lastFailure.occurredAt),
          }),
        }
      : {}),
  });
}

function cloneSnapshot(snapshot: SubscriptionQuantitySnapshot): SubscriptionQuantitySnapshot {
  return {
    ...snapshot,
    sourceEvidence: { ...snapshot.sourceEvidence },
    createdAt: new Date(snapshot.createdAt),
    updatedAt: new Date(snapshot.updatedAt),
    ...(snapshot.lastAttemptAt ? { lastAttemptAt: new Date(snapshot.lastAttemptAt) } : {}),
    ...(snapshot.lastSuccessAt ? { lastSuccessAt: new Date(snapshot.lastSuccessAt) } : {}),
    ...(snapshot.lastFailure
      ? {
          lastFailure: {
            ...snapshot.lastFailure,
            occurredAt: new Date(snapshot.lastFailure.occurredAt),
          },
        }
      : {}),
  };
}
