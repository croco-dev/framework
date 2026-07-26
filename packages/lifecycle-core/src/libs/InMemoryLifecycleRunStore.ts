import type {
  LifecycleRun,
  LifecycleRunClaim,
  LifecycleRunClaimResult,
  LifecycleRunListOptions,
  LifecycleRunStore,
} from "./types";

function byCompletedAtDesc(left: LifecycleRun, right: LifecycleRun): number {
  return right.completedAt.getTime() - left.completedAt.getTime();
}

export class InMemoryLifecycleRunStore implements LifecycleRunStore {
  private readonly runs: LifecycleRun[] = [];
  private readonly claims = new Map<string, LifecycleRunClaim>();

  async claim(claim: LifecycleRunClaim): Promise<LifecycleRunClaimResult> {
    const duplicateRun = this.runs.some(
      (run) => run.idempotencyKey === claim.idempotencyKey && run.status !== "skipped",
    );
    if (duplicateRun || this.claims.has(claim.idempotencyKey)) {
      return { claimed: false, reason: "idempotency_key_reused" };
    }

    if (claim.cooldownSince) {
      const cooldownSince = claim.cooldownSince;
      const completedInWindow = this.runs.some(
        (run) =>
          run.tenantId === claim.tenantId &&
          run.ruleId === claim.ruleId &&
          run.status !== "skipped" &&
          run.completedAt >= cooldownSince,
      );
      const claimedInWindow = Array.from(this.claims.values()).some(
        (candidate) =>
          candidate.tenantId === claim.tenantId &&
          candidate.ruleId === claim.ruleId &&
          candidate.claimedAt >= cooldownSince,
      );
      if (completedInWindow || claimedInWindow) {
        return { claimed: false, reason: "cooldown_active" };
      }
    }

    this.claims.set(claim.idempotencyKey, claim);
    return { claimed: true };
  }

  async abortClaim(runId: string, idempotencyKey: string): Promise<void> {
    const claim = this.claims.get(idempotencyKey);
    if (claim?.runId === runId) {
      this.claims.delete(idempotencyKey);
    }
  }

  async save(run: LifecycleRun): Promise<void> {
    const claim = this.claims.get(run.idempotencyKey);
    if (claim?.runId === run.id) {
      this.claims.delete(run.idempotencyKey);
    }
    this.runs.push(run);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<LifecycleRun | null> {
    return (
      this.runs.find((run) => run.idempotencyKey === idempotencyKey && run.status !== "skipped") ??
      null
    );
  }

  async findLatestForRule(
    tenantId: string,
    ruleId: string,
    since?: Date,
  ): Promise<LifecycleRun | null> {
    return (
      this.runs
        .filter(
          (run) =>
            run.tenantId === tenantId &&
            run.ruleId === ruleId &&
            run.status !== "skipped" &&
            (since === undefined || run.completedAt >= since),
        )
        .sort(byCompletedAtDesc)[0] ?? null
    );
  }

  async list(options: LifecycleRunListOptions = {}): Promise<readonly LifecycleRun[]> {
    const limit = options.limit ?? Number.POSITIVE_INFINITY;

    return this.runs
      .filter((run) => options.tenantId === undefined || run.tenantId === options.tenantId)
      .filter((run) => options.ruleId === undefined || run.ruleId === options.ruleId)
      .sort(byCompletedAtDesc)
      .slice(0, limit);
  }
}
