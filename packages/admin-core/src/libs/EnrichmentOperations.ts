import type {
  EnrichmentService,
  EnrichmentScope,
  EnrichmentInput,
  ClassificationLimits,
} from "@croco/analytics-core/enrichment";

/** Server operations resolve principal/scope from the request, never from browser fields. */
export class EnrichmentOperations {
  constructor(
    private readonly service: EnrichmentService,
    private readonly options: {
      readonly context: () => Promise<{ scope: EnrichmentScope; actor: string }>;
      readonly definitionId: string;
      readonly versions: readonly string[];
    },
  ) {}
  private version(version: string): string {
    // Service also validates the code-registered definition; no handler/model supplied by clients.
    return this.options.versions.includes(version) ? version : "";
  }
  async enqueue(
    runId: string,
    inputs: readonly EnrichmentInput[],
    limits: ClassificationLimits,
    retention: { rawMs: number; resultMs: number },
  ) {
    const { scope } = await this.options.context();
    return this.service.enqueueBatch(scope, runId, inputs, limits, retention);
  }
  async read(runId: string, offset = 0) {
    const { scope } = await this.options.context();
    return this.service.read(scope, runId, offset, 20);
  }
  async classify(runId: string, itemId: string, version: string, signal?: AbortSignal) {
    const { scope } = await this.options.context();
    await this.service.classify(
      scope,
      runId,
      itemId,
      this.options.definitionId,
      this.version(version),
      signal,
    );
    await this.service.settle(scope, runId);
    return this.service.read(scope, runId);
  }
  async review(
    runId: string,
    input: {
      itemId: string;
      version: string;
      labelId: string;
      evidence: string;
      reason: string;
      expectedRevision: number;
      idempotencyKey: string;
    },
  ) {
    const { scope, actor } = await this.options.context();
    return this.service.review(
      scope,
      runId,
      input.itemId,
      this.options.definitionId,
      this.version(input.version),
      input.labelId,
      input.evidence,
      { ...input, actor },
    );
  }
  async retry(
    runId: string,
    input: {
      itemId: string;
      receiptId: string;
      acknowledgeDuplicateBilling: boolean;
      reason: string;
      expectedRevision: number;
      idempotencyKey: string;
    },
  ) {
    const { scope, actor } = await this.options.context();
    await this.service.retry(
      scope,
      runId,
      input.itemId,
      input.receiptId,
      input.acknowledgeDuplicateBilling,
      { ...input, actor },
    );
    return this.service.read(scope, runId);
  }
  async exportLabels(
    runId: string,
    input: { version: string; reason: string; expectedRevision: number; idempotencyKey: string },
  ) {
    const { scope, actor } = await this.options.context();
    return this.service.exportLabels(
      scope,
      runId,
      this.options.definitionId,
      this.version(input.version),
      { ...input, actor },
    );
  }
  async settle(runId: string) {
    const { scope } = await this.options.context();
    await this.service.settle(scope, runId);
    return this.service.read(scope, runId);
  }
}
