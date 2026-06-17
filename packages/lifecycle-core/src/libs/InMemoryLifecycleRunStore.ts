import type { LifecycleRun, LifecycleRunListOptions, LifecycleRunStore } from "./types";

function byCompletedAtDesc(left: LifecycleRun, right: LifecycleRun): number {
  return right.completedAt.getTime() - left.completedAt.getTime();
}

export class InMemoryLifecycleRunStore implements LifecycleRunStore {
  private readonly runs: LifecycleRun[] = [];

  async save(run: LifecycleRun): Promise<void> {
    this.runs.push(run);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<LifecycleRun | null> {
    return (
      this.runs.find(
        (run) =>
          run.idempotencyKey === idempotencyKey && run.skipReason !== "idempotency_key_reused",
      ) ?? null
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
