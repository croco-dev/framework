import type { LifecycleDryRunResult, LifecycleDryRunStore } from "./types";

export class InMemoryLifecycleDryRunStore implements LifecycleDryRunStore {
  private readonly results: LifecycleDryRunResult[] = [];

  save(result: LifecycleDryRunResult): void {
    this.results.push(result);
  }

  list(
    options: { readonly ruleId?: string; readonly limit?: number } = {},
  ): readonly LifecycleDryRunResult[] {
    const limit = options.limit ?? Number.POSITIVE_INFINITY;
    return this.results
      .filter((result) => options.ruleId === undefined || result.ruleId === options.ruleId)
      .sort((left, right) => right.evaluatedAt.getTime() - left.evaluatedAt.getTime())
      .slice(0, limit);
  }
}
