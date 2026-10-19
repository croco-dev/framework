import { EnrichmentProblem } from "@croco/analytics-core/enrichment";
import type {
  EnrichmentRun,
  EnrichmentScope,
  EnrichmentStore,
} from "@croco/analytics-core/enrichment";
export class MemoryStore implements EnrichmentStore {
  private readonly rows = new Map<string, EnrichmentRun>();
  private readonly sources = new Map<string, string>();
  private key(scope: EnrichmentScope, runId: string) {
    return JSON.stringify([scope.app, scope.environment, scope.tenant, runId]);
  }
  async create(run: EnrichmentRun) {
    const key = this.key(run.scope, run.runId);
    const incoming = run.items.map((item) => ({
      key: JSON.stringify([
        run.scope.app,
        run.scope.environment,
        run.scope.tenant,
        item.input.itemId,
        item.input.inputRevision,
      ]),
      hash: item.sourceHash,
    }));
    for (const entry of incoming)
      if (this.sources.has(entry.key) && this.sources.get(entry.key) !== entry.hash)
        throw new EnrichmentProblem("input-conflict");
    const existing = this.rows.get(key);
    if (existing && existing.fingerprint !== run.fingerprint)
      throw new EnrichmentProblem("input-conflict");
    for (const entry of incoming) this.sources.set(entry.key, entry.hash);
    if (!this.rows.has(key)) this.rows.set(key, structuredClone(run));
    return structuredClone(this.rows.get(key) as EnrichmentRun);
  }
  async load(scope: EnrichmentScope, runId: string) {
    const row = this.rows.get(this.key(scope, runId));
    return row ? structuredClone(row) : null;
  }
  async compareAndSet(run: EnrichmentRun, revision: number) {
    const key = this.key(run.scope, run.runId);
    if (this.rows.get(key)?.revision !== revision) return false;
    this.rows.set(key, structuredClone(run));
    return true;
  }
}
