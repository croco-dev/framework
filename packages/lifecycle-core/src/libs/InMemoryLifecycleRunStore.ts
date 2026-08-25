import {
  LifecycleRunEvidenceProblem,
  LifecycleRunFinalizationProblem,
} from "./problems/LifecycleProblems";
import type {
  LifecycleActionResult,
  LifecycleFinalizedRun,
  LifecycleIndeterminateRun,
  LifecycleRun,
  LifecycleRunClaim,
  LifecycleRunClaimResult,
  LifecycleRunFinalizationResult,
  LifecycleRunListOptions,
  LifecycleRunStore,
} from "./types";

function byCompletedAtDesc(left: LifecycleRun, right: LifecycleRun): number {
  return right.completedAt.getTime() - left.completedAt.getTime();
}

type LifecycleRunClaimIdentity = Pick<
  LifecycleRunClaim,
  "idempotencyKey" | "ruleId" | "runId" | "tenantId"
>;

function snapshotClaimIdentity(claim: LifecycleRunClaim): LifecycleRunClaimIdentity {
  return {
    runId: claim.runId,
    idempotencyKey: claim.idempotencyKey,
    tenantId: claim.tenantId,
    ruleId: claim.ruleId,
  };
}

function snapshotClaim(
  claim: LifecycleRunClaim,
  identity: LifecycleRunClaimIdentity,
  cooldownSince: Date | undefined,
): LifecycleRunClaim {
  const claimedAt = claim.claimedAt;
  return {
    ...identity,
    claimedAt: new Date(claimedAt.getTime()),
    ...(cooldownSince ? { cooldownSince: new Date(cooldownSince.getTime()) } : {}),
  };
}

function snapshotMetadata(
  metadata: Record<string, unknown>,
  runId: string,
  actionId: string,
): Record<string, unknown> {
  try {
    return structuredClone(metadata);
  } catch (error) {
    if (error instanceof Error && error.name === "DataCloneError") {
      throw new LifecycleRunEvidenceProblem(runId, actionId);
    }
    throw error;
  }
}

function snapshotActionResult(result: LifecycleActionResult, runId: string): LifecycleActionResult {
  const error = result.error;
  const metadata = result.metadata;
  return {
    actionId: result.actionId,
    type: result.type,
    status: result.status,
    ...(result.message !== undefined ? { message: result.message } : {}),
    ...(result.emissionId !== undefined ? { emissionId: result.emissionId } : {}),
    ...(error ? { error: { ...error } } : {}),
    ...(metadata ? { metadata: snapshotMetadata(metadata, runId, result.actionId) } : {}),
  };
}

type LifecycleRunIdentity = Pick<LifecycleRun, "id" | "idempotencyKey" | "ruleId" | "tenantId">;
type LifecycleRunFence = Pick<LifecycleRunIdentity, "id" | "idempotencyKey">;
type LifecycleRunFinalizationRejection = Exclude<
  LifecycleRunFinalizationResult,
  { readonly finalized: true }
>;

function snapshotRunFence(run: LifecycleRun): LifecycleRunFence {
  return {
    id: run.id,
    idempotencyKey: run.idempotencyKey,
  };
}

function snapshotRunIdentity(
  run: LifecycleRun,
  fence = snapshotRunFence(run),
): LifecycleRunIdentity {
  return {
    ...fence,
    ruleId: run.ruleId,
    tenantId: run.tenantId,
  };
}

function snapshotRun(
  run: LifecycleIndeterminateRun,
  identity?: LifecycleRunIdentity,
): LifecycleIndeterminateRun;
function snapshotRun(
  run: LifecycleFinalizedRun,
  identity?: LifecycleRunIdentity,
): LifecycleFinalizedRun;
function snapshotRun(run: LifecycleRun, identity?: LifecycleRunIdentity): LifecycleRun;
function snapshotRun(run: LifecycleRun, identity = snapshotRunIdentity(run)): LifecycleRun {
  const error = run.error;
  return {
    ...identity,
    ruleVersion: run.ruleVersion,
    ruleFingerprint: run.ruleFingerprint,
    signalType: run.signalType,
    ...(run.signalId !== undefined ? { signalId: run.signalId } : {}),
    severity: run.severity,
    status: run.status,
    ...(run.skipReason !== undefined ? { skipReason: run.skipReason } : {}),
    actionResults: run.actionResults.map((result) => snapshotActionResult(result, identity.id)),
    ...(error ? { error: { ...error } } : {}),
    startedAt: new Date(run.startedAt.getTime()),
    completedAt: new Date(run.completedAt.getTime()),
  };
}

export class InMemoryLifecycleRunStore implements LifecycleRunStore {
  private readonly runs: LifecycleRun[] = [];
  private readonly claims = new Map<string, LifecycleRunClaim>();

  async claim(
    claim: LifecycleRunClaim,
    dispatchingRun: LifecycleIndeterminateRun,
  ): Promise<LifecycleRunClaimResult> {
    const claimedIdentity = snapshotClaimIdentity(claim);
    const dispatchingIdentity = snapshotRunIdentity(dispatchingRun);
    if (
      dispatchingIdentity.id !== claimedIdentity.runId ||
      dispatchingIdentity.idempotencyKey !== claimedIdentity.idempotencyKey ||
      dispatchingIdentity.tenantId !== claimedIdentity.tenantId ||
      dispatchingIdentity.ruleId !== claimedIdentity.ruleId
    ) {
      throw new LifecycleRunFinalizationProblem(claimedIdentity.runId, "dispatch_claim_mismatch");
    }
    const findRejection = (cooldownSince?: Date): LifecycleRunClaimResult | null => {
      const duplicateRun = this.runs.some(
        (run) => run.idempotencyKey === claimedIdentity.idempotencyKey && run.status !== "skipped",
      );
      if (duplicateRun || this.claims.has(claimedIdentity.idempotencyKey)) {
        return { claimed: false, reason: "idempotency_key_reused" };
      }
      if (!cooldownSince) {
        return null;
      }
      const completedInWindow = this.runs.some(
        (run) =>
          run.tenantId === claimedIdentity.tenantId &&
          run.ruleId === claimedIdentity.ruleId &&
          run.status !== "skipped" &&
          run.completedAt >= cooldownSince,
      );
      const claimedInWindow = Array.from(this.claims.values()).some(
        (candidate) =>
          candidate.tenantId === claimedIdentity.tenantId &&
          candidate.ruleId === claimedIdentity.ruleId &&
          candidate.claimedAt >= cooldownSince,
      );
      if (completedInWindow || claimedInWindow) {
        return { claimed: false, reason: "cooldown_active" };
      }
      return null;
    };

    const duplicateRejection = findRejection();
    if (duplicateRejection) {
      return duplicateRejection;
    }
    const claimCooldownSince = claim.cooldownSince;
    const cooldownSince = claimCooldownSince ? new Date(claimCooldownSince.getTime()) : undefined;
    const initialRejection = findRejection(cooldownSince);
    if (initialRejection) {
      return initialRejection;
    }
    const claimedSnapshot = snapshotClaim(claim, claimedIdentity, cooldownSince);
    const dispatchingSnapshot = snapshotRun(dispatchingRun, dispatchingIdentity);
    const reentrantRejection = findRejection(cooldownSince);
    if (reentrantRejection) {
      return reentrantRejection;
    }

    this.claims.set(claimedSnapshot.idempotencyKey, claimedSnapshot);
    this.runs.push(dispatchingSnapshot);
    return { claimed: true };
  }

  async abortClaim(runId: string, idempotencyKey: string): Promise<void> {
    const claim = this.claims.get(idempotencyKey);
    if (claim?.runId === runId) {
      this.claims.delete(idempotencyKey);
      const dispatchIndex = this.runs.findIndex(
        (run) =>
          run.id === runId &&
          run.idempotencyKey === idempotencyKey &&
          run.status === "indeterminate",
      );
      if (dispatchIndex >= 0) {
        this.runs.splice(dispatchIndex, 1);
      }
    }
  }

  async finalizeDispatch(run: LifecycleFinalizedRun) {
    const finalizedFence = snapshotRunFence(run);
    const findDispatch = ():
      | { readonly index: number }
      | { readonly result: LifecycleRunFinalizationRejection } => {
      const index = this.runs.findIndex((candidate) => candidate.id === finalizedFence.id);
      if (index < 0) {
        return { result: { finalized: false, reason: "dispatch_not_found" } as const };
      }
      const dispatch = this.runs[index];
      if (
        dispatch?.status !== "indeterminate" ||
        dispatch.idempotencyKey !== finalizedFence.idempotencyKey
      ) {
        return { result: { finalized: false, reason: "dispatch_fence_mismatch" } as const };
      }
      return { index };
    };

    const initialDispatch = findDispatch();
    if ("result" in initialDispatch) {
      return initialDispatch.result;
    }
    const finalizedIdentity = snapshotRunIdentity(run, finalizedFence);
    const finalizedSnapshot = snapshotRun(run, finalizedIdentity);
    const currentDispatch = findDispatch();
    if ("result" in currentDispatch) {
      return currentDispatch.result;
    }

    this.runs[currentDispatch.index] = finalizedSnapshot;
    const claim = this.claims.get(finalizedSnapshot.idempotencyKey);
    if (claim?.runId === finalizedSnapshot.id) {
      this.claims.delete(finalizedSnapshot.idempotencyKey);
    }
    return { finalized: true } as const;
  }

  async save(run: LifecycleFinalizedRun): Promise<void> {
    this.runs.push(snapshotRun(run));
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<LifecycleRun | null> {
    const run =
      this.runs.find((run) => run.idempotencyKey === idempotencyKey && run.status !== "skipped") ??
      null;
    return run ? snapshotRun(run) : null;
  }

  async findLatestForRule(
    tenantId: string,
    ruleId: string,
    since?: Date,
  ): Promise<LifecycleRun | null> {
    const run =
      this.runs
        .filter(
          (run) =>
            run.tenantId === tenantId &&
            run.ruleId === ruleId &&
            run.status !== "skipped" &&
            (since === undefined || run.completedAt >= since),
        )
        .sort(byCompletedAtDesc)[0] ?? null;
    return run ? snapshotRun(run) : null;
  }

  async list(options: LifecycleRunListOptions = {}): Promise<readonly LifecycleRun[]> {
    const limit = options.limit ?? Number.POSITIVE_INFINITY;

    return this.runs
      .filter((run) => options.tenantId === undefined || run.tenantId === options.tenantId)
      .filter((run) => options.ruleId === undefined || run.ruleId === options.ruleId)
      .sort(byCompletedAtDesc)
      .slice(0, limit)
      .map((run) => snapshotRun(run));
  }
}
