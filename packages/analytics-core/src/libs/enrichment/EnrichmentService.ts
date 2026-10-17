import { createHash, randomUUID } from "node:crypto";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  ClassificationDefinition,
  ClassificationLimits,
  ClassifyText,
  EnrichmentCandidate,
  EnrichmentCommand,
  EnrichmentInput,
  EnrichmentItem,
  EnrichmentPage,
  EnrichmentReceipt,
  EnrichmentRun,
  EnrichmentScope,
  EnrichmentStore,
  EnrichmentUsage,
} from "./Enrichment";

const ENRICHMENT_PROBLEMS = {
  "acceptance-unknown": {
    code: "analytics-core/enrichment-acceptance-unknown",
    category: ProblemCategory.InternalServerError,
  },
  "attempt-limit": {
    code: "analytics-core/enrichment-attempt-limit",
    category: ProblemCategory.BadRequest,
  },
  "audit-limit": {
    code: "analytics-core/enrichment-audit-limit",
    category: ProblemCategory.BadRequest,
  },
  "authority-changed": {
    code: "analytics-core/enrichment-authority-changed",
    category: ProblemCategory.Forbidden,
  },
  "budget-exhausted": {
    code: "analytics-core/enrichment-budget-exhausted",
    category: ProblemCategory.TooManyRequests,
  },
  cancelled: { code: "analytics-core/enrichment-cancelled", category: ProblemCategory.BadRequest },
  "candidate-required": {
    code: "analytics-core/enrichment-candidate-required",
    category: ProblemCategory.BadRequest,
  },
  "candidate-running": {
    code: "analytics-core/enrichment-candidate-running",
    category: ProblemCategory.BadRequest,
  },
  "concurrency-limit": {
    code: "analytics-core/enrichment-concurrency-limit",
    category: ProblemCategory.TooManyRequests,
  },
  conflict: { code: "analytics-core/enrichment-conflict", category: ProblemCategory.Conflict },
  "definition-mismatch": {
    code: "analytics-core/enrichment-definition-mismatch",
    category: ProblemCategory.BadRequest,
  },
  "definition-unavailable": {
    code: "analytics-core/enrichment-definition-unavailable",
    category: ProblemCategory.BadRequest,
  },
  denied: { code: "analytics-core/enrichment-denied", category: ProblemCategory.Forbidden },
  "duplicate-billing-acknowledgement-required": {
    code: "analytics-core/enrichment-duplicate-billing-acknowledgement-required",
    category: ProblemCategory.BadRequest,
  },
  "idempotency-conflict": {
    code: "analytics-core/enrichment-idempotency-conflict",
    category: ProblemCategory.Conflict,
  },
  "input-budget": {
    code: "analytics-core/enrichment-input-budget",
    category: ProblemCategory.BadRequest,
  },
  "input-conflict": {
    code: "analytics-core/enrichment-input-conflict",
    category: ProblemCategory.Conflict,
  },
  "invalid-actor": {
    code: "analytics-core/enrichment-invalid-actor",
    category: ProblemCategory.BadRequest,
  },
  "invalid-authority-revision": {
    code: "analytics-core/enrichment-invalid-authority-revision",
    category: ProblemCategory.BadRequest,
  },
  "invalid-batch": {
    code: "analytics-core/enrichment-invalid-batch",
    category: ProblemCategory.BadRequest,
  },
  "invalid-catalog": {
    code: "analytics-core/enrichment-invalid-catalog",
    category: ProblemCategory.BadRequest,
  },
  "invalid-command": {
    code: "analytics-core/enrichment-invalid-command",
    category: ProblemCategory.BadRequest,
  },
  "invalid-context": {
    code: "analytics-core/enrichment-invalid-context",
    category: ProblemCategory.BadRequest,
  },
  "invalid-definition": {
    code: "analytics-core/enrichment-invalid-definition",
    category: ProblemCategory.BadRequest,
  },
  "invalid-input": {
    code: "analytics-core/enrichment-invalid-input",
    category: ProblemCategory.BadRequest,
  },
  "invalid-limits": {
    code: "analytics-core/enrichment-invalid-limits",
    category: ProblemCategory.BadRequest,
  },
  "invalid-model-policy": {
    code: "analytics-core/enrichment-invalid-model-policy",
    category: ProblemCategory.BadRequest,
  },
  "invalid-page": {
    code: "analytics-core/enrichment-invalid-page",
    category: ProblemCategory.BadRequest,
  },
  "invalid-review": {
    code: "analytics-core/enrichment-invalid-review",
    category: ProblemCategory.BadRequest,
  },
  "invalid-revision": {
    code: "analytics-core/enrichment-invalid-revision",
    category: ProblemCategory.BadRequest,
  },
  "invalid-run": {
    code: "analytics-core/enrichment-invalid-run",
    category: ProblemCategory.BadRequest,
  },
  "invalid-scope": {
    code: "analytics-core/enrichment-invalid-scope",
    category: ProblemCategory.BadRequest,
  },
  "invalid-usage": {
    code: "analytics-core/enrichment-invalid-usage",
    category: ProblemCategory.BadRequest,
  },
  "local-database-required": {
    code: "analytics-core/enrichment-local-database-required",
    category: ProblemCategory.BadRequest,
  },
  "local-provider-unavailable": {
    code: "analytics-core/enrichment-local-provider-unavailable",
    category: ProblemCategory.BadRequest,
  },
  "local-server-unavailable": {
    code: "analytics-core/enrichment-local-server-unavailable",
    category: ProblemCategory.BadRequest,
  },
  "not-found": { code: "analytics-core/enrichment-not-found", category: ProblemCategory.NotFound },
  "persistence-failed": {
    code: "analytics-core/enrichment-persistence-failed",
    category: ProblemCategory.InternalServerError,
  },
  "provider-failed": {
    code: "analytics-core/enrichment-provider-failed",
    category: ProblemCategory.InternalServerError,
  },
  "raw-expired": { code: "analytics-core/enrichment-raw-expired", category: ProblemCategory.Gone },
  "result-expired": {
    code: "analytics-core/enrichment-result-expired",
    category: ProblemCategory.Gone,
  },
  "retry-unavailable": {
    code: "analytics-core/enrichment-retry-unavailable",
    category: ProblemCategory.BadRequest,
  },
  "review-required": {
    code: "analytics-core/enrichment-review-required",
    category: ProblemCategory.BadRequest,
  },
  "settlement-failed": {
    code: "analytics-core/enrichment-settlement-failed",
    category: ProblemCategory.InternalServerError,
  },
  "source-unavailable": {
    code: "analytics-core/enrichment-source-unavailable",
    category: ProblemCategory.Forbidden,
  },
  "version-limit": {
    code: "analytics-core/enrichment-version-limit",
    category: ProblemCategory.BadRequest,
  },
} as const;
export type EnrichmentProblemReason = keyof typeof ENRICHMENT_PROBLEMS;
export class EnrichmentProblem extends Problem {
  constructor(reason: EnrichmentProblemReason, cause?: unknown) {
    const metadata = ENRICHMENT_PROBLEMS[reason];
    super(metadata.code, metadata.category, "Enrichment operation could not complete", {
      cause: cause instanceof Error ? cause : undefined,
    });
  }
}
const fail = (reason: EnrichmentProblemReason): never => {
  throw new EnrichmentProblem(reason);
};
const bytes = (text: string): number => Buffer.byteLength(text, "utf8");
const hash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalize = (text: string): string => text.normalize("NFKC").trim().toLowerCase();
const identifier = (value: unknown): value is string =>
  typeof value === "string" && /^[\w.:/-]{1,128}$/.test(value);
const positive = (value: number): boolean => Number.isSafeInteger(value) && value > 0;
export function enrichmentScopeKey(scope: EnrichmentScope): string {
  if (
    !scope ||
    !identifier(scope.app) ||
    !identifier(scope.environment) ||
    !identifier(scope.tenant)
  )
    fail("invalid-scope");
  return JSON.stringify([scope.app, scope.environment, scope.tenant]);
}
function contextKey(context: Readonly<Record<string, string>>): string {
  if (
    !context ||
    Object.getPrototypeOf(context) !== Object.prototype ||
    Object.keys(context).length > 32 ||
    Object.entries(context).some(
      ([key, value]) => !identifier(key) || typeof value !== "string" || value.length > 1024,
    )
  )
    fail("invalid-context");
  const sorted = Object.fromEntries(
    Object.entries(context).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  if (bytes(JSON.stringify(sorted)) > 4096) fail("invalid-context");
  return JSON.stringify(sorted);
}
export function defineClassification(
  definition: ClassificationDefinition,
): ClassificationDefinition {
  if (
    !definition ||
    !identifier(definition.id) ||
    !identifier(definition.version) ||
    definition.schema !== "label-id/v1" ||
    definition.normalization?.form !== "nfkc-trim-lowercase" ||
    !identifier(definition.normalization.version) ||
    !Array.isArray(definition.labels) ||
    definition.labels.length < 1 ||
    definition.labels.length > 100 ||
    Array.from(definition.labels).some(
      (label) =>
        !label ||
        typeof label !== "object" ||
        !identifier(label.id) ||
        typeof label.label !== "string" ||
        !label.label.trim() ||
        label.label.length > 200,
    ) ||
    new Set(definition.labels.map((label) => label.id)).size !== definition.labels.length ||
    !Array.isArray(definition.referenceCatalog) ||
    definition.referenceCatalog.length > 1000
  )
    fail("invalid-definition");
  const keys = new Set<string>();
  for (const entry of definition.referenceCatalog) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.text !== "string" ||
      !normalize(entry.text) ||
      bytes(entry.text) > 16384 ||
      !definition.labels.some((label) => label.id === entry.labelId) ||
      keys.has(normalize(entry.text))
    )
      fail("invalid-catalog");
    keys.add(normalize(entry.text));
  }
  if (
    definition.modelPolicy &&
    (!identifier(definition.modelPolicy.modelRef) ||
      !identifier(definition.modelPolicy.promptVersion) ||
      typeof definition.modelPolicy.instructions !== "string" ||
      bytes(definition.modelPolicy.instructions) > 16384)
  )
    fail("invalid-model-policy");
  return {
    id: definition.id,
    version: definition.version,
    schema: definition.schema,
    labels: definition.labels.map((label) => ({ id: label.id, label: label.label })),
    normalization: {
      version: definition.normalization.version,
      form: definition.normalization.form,
    },
    referenceCatalog: definition.referenceCatalog.map((entry) => ({
      text: entry.text,
      labelId: entry.labelId,
    })),
    ...(definition.modelPolicy
      ? {
          modelPolicy: {
            modelRef: definition.modelPolicy.modelRef,
            promptVersion: definition.modelPolicy.promptVersion,
            instructions: definition.modelPolicy.instructions,
          },
        }
      : {}),
  };
}
function usage(value: EnrichmentUsage): EnrichmentUsage {
  if (!value || typeof value !== "object") fail("invalid-usage");
  if (value.kind === "unknown") return { kind: "unknown" };
  if (
    !["known", "estimated"].includes(value.kind) ||
    !Number.isSafeInteger(value.inputTokens) ||
    value.inputTokens < 0 ||
    !Number.isSafeInteger(value.outputTokens) ||
    value.outputTokens < 0 ||
    !Number.isSafeInteger(value.inputTokens + value.outputTokens)
  )
    fail("invalid-usage");
  return { kind: value.kind, inputTokens: value.inputTokens, outputTokens: value.outputTokens };
}
export type EnrichmentServiceOptions = {
  readonly store: EnrichmentStore;
  readonly definitions: readonly ClassificationDefinition[];
  readonly classifyText?: ClassifyText;
  /** Server resolves the current principal; actor is an audit claim to verify, not a credential. */
  readonly authorize: (
    scope: EnrichmentScope,
    action: "classify" | "read" | "review" | "export" | "purge",
    actor?: string,
  ) => Promise<boolean>;
  /** Rechecked before cache reads, SDK transmission, review and export. False revokes cached results too. */
  readonly currentActor: (scope: EnrichmentScope) => Promise<string>;
  readonly authorizationRevision: (scope: EnrichmentScope) => Promise<string>;
  readonly sourceAvailable: (
    scope: EnrichmentScope,
    sourceRef: string,
    inputRevision: string,
  ) => Promise<boolean>;
  /** Mandatory app-owned PII block/mask policy. Null blocks transmission. Context must also be sanitized. */
  readonly prepareInput: (
    input: EnrichmentInput,
  ) => { text: string; context: Readonly<Record<string, string>> } | null;
  /** Idempotent execution/events/metering sink, keyed by candidate.receiptId. Contains no raw text. */
  readonly settle: (receipt: EnrichmentReceipt) => Promise<void>;
  readonly now?: () => number;
};

/** Bounded per-run persistence and budgets. No global registry, auto approval, or implicit inference retry. */
export class EnrichmentService {
  private readonly definitions: readonly ClassificationDefinition[];
  private readonly now: () => number;
  private readonly artifacts = new Map<
    ClassificationDefinition,
    { catalogHash: string; promptHash: string; dictionary: ReadonlyMap<string, string> }
  >();
  constructor(private readonly options: EnrichmentServiceOptions) {
    this.definitions = options.definitions.map(defineClassification);
    if (
      new Set(this.definitions.map((item) => JSON.stringify([item.id, item.version]))).size !==
      this.definitions.length
    )
      fail("invalid-definition");
    for (const definition of this.definitions)
      this.artifacts.set(definition, {
        catalogHash: hash([definition.labels, definition.referenceCatalog]),
        promptHash: hash(definition.modelPolicy ?? null),
        dictionary: new Map(
          definition.referenceCatalog.map((entry) => [normalize(entry.text), entry.labelId]),
        ),
      });
    this.now = options.now ?? Date.now;
  }
  private definition(id: string, version: string): ClassificationDefinition {
    return (
      this.definitions.find((item) => item.id === id && item.version === version) ??
      fail("definition-unavailable")
    );
  }
  private async allow(
    scope: EnrichmentScope,
    action: Parameters<EnrichmentServiceOptions["authorize"]>[1],
    actor?: string,
  ): Promise<void> {
    enrichmentScopeKey(scope);
    if (!(await this.options.authorize(scope, action, actor))) fail("denied");
  }
  private async load(scope: EnrichmentScope, runId: string): Promise<EnrichmentRun> {
    if (!identifier(runId)) fail("invalid-run");
    return (await this.options.store.load(scope, runId)) ?? fail("not-found");
  }
  private async mutate<T>(
    scope: EnrichmentScope,
    runId: string,
    change: (run: EnrichmentRun) => T,
  ): Promise<T> {
    // Retry only CAS contention. Never repeat an external invocation inside this function.
    for (let attempt = 0; attempt < 16; attempt++) {
      const run = await this.load(scope, runId);
      const revision = run.revision;
      const before = JSON.stringify(run);
      const result = change(run);
      if (JSON.stringify(run) === before) return result;
      run.revision++;
      if (await this.options.store.compareAndSet(run, revision)) return result;
    }
    return fail("conflict");
  }
  async enqueueBatch(
    scope: EnrichmentScope,
    runId: string,
    inputs: readonly EnrichmentInput[],
    limits: ClassificationLimits,
    retention: { rawMs: number; resultMs: number },
  ): Promise<EnrichmentPage> {
    await this.allow(scope, "classify");
    if (
      !identifier(runId) ||
      !Array.isArray(inputs) ||
      inputs.length < 1 ||
      inputs.length > 100 ||
      new Set(inputs.map((item) => item.itemId)).size !== inputs.length
    )
      fail("invalid-batch");
    if (
      !limits ||
      [
        "maxInputBytes",
        "maxOutputBytes",
        "maxOutputTokens",
        "timeoutMs",
        "maxConcurrency",
        "maxAttempts",
        "maxRequests",
        "maxReservedTokens",
        "tokensPerRequest",
      ].some((key) => !positive(limits[key as keyof ClassificationLimits])) ||
      limits.maxInputBytes > 16384 ||
      limits.maxOutputBytes > 16384 ||
      limits.maxConcurrency > 16 ||
      limits.maxAttempts > 3 ||
      limits.timeoutMs > 60000 ||
      limits.tokensPerRequest < limits.maxOutputTokens ||
      limits.maxReservedTokens < limits.tokensPerRequest ||
      !positive(retention.rawMs) ||
      !positive(retention.resultMs) ||
      retention.rawMs > retention.resultMs
    )
      fail("invalid-limits");
    for (const item of inputs) {
      if (
        !identifier(item.itemId) ||
        !identifier(item.inputRevision) ||
        !identifier(item.sourceRef) ||
        typeof item.text !== "string" ||
        !item.text.trim() ||
        bytes(item.text) > limits.maxInputBytes
      )
        fail("invalid-input");
      contextKey(item.context);
      if (!(await this.options.sourceAvailable(scope, item.sourceRef, item.inputRevision)))
        fail("source-unavailable");
    }
    const recordedLimits: ClassificationLimits = {
      maxInputBytes: limits.maxInputBytes,
      maxOutputBytes: limits.maxOutputBytes,
      maxOutputTokens: limits.maxOutputTokens,
      timeoutMs: limits.timeoutMs,
      maxConcurrency: limits.maxConcurrency,
      maxAttempts: limits.maxAttempts,
      maxRequests: limits.maxRequests,
      maxReservedTokens: limits.maxReservedTokens,
      tokensPerRequest: limits.tokensPerRequest,
    };
    const actor = await this.options.currentActor(scope);
    if (!identifier(actor)) fail("invalid-actor");
    const fingerprint = hash([
      inputs.map((input) => [
        input.itemId,
        input.inputRevision,
        input.text,
        input.sourceRef,
        contextKey(input.context),
      ]),
      recordedLimits,
      { rawMs: retention.rawMs, resultMs: retention.resultMs },
    ]);
    const run = await this.options.store.create({
      scope: { app: scope.app, environment: scope.environment, tenant: scope.tenant },
      runId,
      revision: 0,
      fingerprint,
      requests: 0,
      reservedTokens: 0,
      limits: recordedLimits,
      rawExpiresAt: this.now() + retention.rawMs,
      resultExpiresAt: this.now() + retention.resultMs,
      items: inputs.map((input) => ({
        input: {
          itemId: input.itemId,
          inputRevision: input.inputRevision,
          sourceRef: input.sourceRef,
          text: input.text,
          context: structuredClone(input.context),
        },
        sourceHash: hash([input.sourceRef, input.text]),
        normalizedHash: hash(normalize(input.text)),
        contextHash: hash(contextKey(input.context)),
        candidates: [],
        reviews: [],
      })),
      audit: [
        {
          actor,
          action: "enqueue",
          reason: "Accepted validated batch",
          idempotencyKey: "enqueue",
          fingerprint,
          revision: 0,
        },
      ],
      receipts: [],
      retentionAudit: [],
    });
    if (run.fingerprint !== fingerprint) fail("input-conflict");
    return this.read(scope, runId);
  }
  async classify(
    scope: EnrichmentScope,
    runId: string,
    itemId: string,
    definitionId: string,
    version: string,
    signal?: AbortSignal,
  ): Promise<EnrichmentCandidate> {
    await this.allow(scope, "classify");
    await this.allow(scope, "read");
    const definition = this.definition(definitionId, version);
    const run = await this.load(scope, runId);
    const item = run.items.find((entry) => entry.input.itemId === itemId) ?? fail("not-found");
    await this.live(scope, run, item);
    if (signal?.aborted) fail("cancelled");
    const actor = await this.options.currentActor(scope);
    if (!identifier(actor)) fail("invalid-actor");
    const authorityRevision = await this.options.authorizationRevision(scope);
    if (!identifier(authorityRevision)) fail("invalid-authority-revision");
    const { catalogHash, promptHash, dictionary } =
      this.artifacts.get(definition) ?? fail("invalid-definition");
    const key = hash([
      enrichmentScopeKey(scope),
      itemId,
      item.input.inputRevision,
      item.input.sourceRef,
      definition.id,
      definition.version,
      definition.normalization,
      catalogHash,
      promptHash,
      item.normalizedHash,
      item.contextHash,
      authorityRevision,
      actor,
    ]);
    // Every candidate release shares the same current-policy boundary, including CAS losers.
    const release = async (candidate: EnrichmentCandidate): Promise<EnrichmentCandidate> => {
      await this.live(scope, run, item);
      await this.allow(scope, "classify");
      await this.allow(scope, "read");
      if (
        (await this.options.currentActor(scope)) !== actor ||
        (await this.options.authorizationRevision(scope)) !== authorityRevision
      )
        fail("authority-changed");
      if (this.now() >= run.resultExpiresAt) fail("result-expired");
      return candidate;
    };
    const existing = item.candidates.filter((candidate) => candidate.cacheKey === key).at(-1);
    if (existing && !existing.retryAuthorized) {
      if (existing.state === "running" && (existing.leaseUntil ?? Infinity) <= this.now()) {
        await this.mutate(scope, runId, (current) => {
          const row =
            current.items.find((entry) => entry.input.itemId === itemId) ?? fail("not-found");
          const index = row.candidates.findIndex(
            (candidate) => candidate.receiptId === existing.receiptId,
          );
          if (index >= 0 && row.candidates[index].state === "running") {
            const failed: EnrichmentCandidate = {
              ...existing,
              state: "failed",
              reason: "acceptance-unknown",
              delivery: "pending",
            };
            row.candidates[index] = failed;
            const receipt = current.receipts.find(
              (entry) => entry.candidate.receiptId === existing.receiptId,
            );
            if (receipt) receipt.candidate = this.receiptCandidate(failed);
          }
        });
        return release({
          ...existing,
          state: "failed",
          reason: "acceptance-unknown",
          delivery: "pending",
        });
      }
      return release(existing);
    }
    if (this.now() >= run.rawExpiresAt) fail("raw-expired");
    const text = item.input.text ?? fail("raw-expired");
    const dictionaryLabel = dictionary.get(normalize(text));
    const rule = dictionaryLabel === undefined ? undefined : { labelId: dictionaryLabel };
    const prepared =
      rule || !definition.modelPolicy || !this.options.classifyText
        ? null
        : this.options.prepareInput({ ...item.input, text });
    if (prepared) {
      if (
        typeof prepared.text !== "string" ||
        !prepared.text.trim() ||
        bytes(
          JSON.stringify([
            prepared.text,
            prepared.context,
            definition.labels,
            definition.modelPolicy,
          ]),
        ) > run.limits.maxInputBytes
      )
        fail("input-budget");
      contextKey(prepared.context);
    }
    const useModel =
      !rule && !!definition.modelPolicy && !!this.options.classifyText && prepared !== null;
    const receiptId = randomUUID();
    const candidate: EnrichmentCandidate = {
      cacheKey: key,
      definitionId: definition.id,
      definitionVersion: definition.version,
      normalizationVersion: definition.normalization.version,
      catalogHash,
      modelRef: useModel ? (definition.modelPolicy?.modelRef ?? "none") : "none",
      promptHash,
      attempt: (existing?.attempt ?? 0) + 1,
      state: useModel ? "running" : rule ? "classified" : "unknown",
      method: rule ? "dictionary" : useModel ? "model" : "none",
      ...(rule ? { labelId: rule.labelId } : {}),
      ...(!rule && !useModel
        ? {
            reason:
              definition.modelPolicy && this.options.classifyText
                ? "privacy-blocked"
                : "no-classifier",
          }
        : {}),
      usage: useModel ? { kind: "unknown" } : { kind: "known", inputTokens: 0, outputTokens: 0 },
      receiptId,
      occurredAt: new Date(this.now()).toISOString(),
      delivery: "pending",
      ...(useModel ? { leaseUntil: this.now() + run.limits.timeoutMs + 5000 } : {}),
    };
    const acquired = await this.mutate(scope, runId, (current) => {
      const row = current.items.find((entry) => entry.input.itemId === itemId) ?? fail("not-found");
      const duplicate = row.candidates.filter((entry) => entry.cacheKey === key).at(-1);
      if (duplicate && (!duplicate.retryAuthorized || duplicate.receiptId !== existing?.receiptId))
        return duplicate;
      if (candidate.attempt > current.limits.maxAttempts) fail("attempt-limit");
      if (row.candidates.length >= 8) fail("version-limit");
      if (useModel) {
        if (
          current.requests >= current.limits.maxRequests ||
          current.reservedTokens + current.limits.tokensPerRequest >
            current.limits.maxReservedTokens
        )
          fail("budget-exhausted");
        // An expired lease still occupies a slot: its SDK may be alive in another process.
        const active = current.receipts.filter(
          ({ candidate: entry }) =>
            entry.state === "running" ||
            (entry.reason === "acceptance-unknown" && !entry.retryAuthorized),
        ).length;
        if (active >= current.limits.maxConcurrency) fail("concurrency-limit");
        current.requests++;
        current.reservedTokens += current.limits.tokensPerRequest;
      }
      if (current.audit.length >= 1000) fail("audit-limit");
      current.audit.push({
        actor,
        action: "classify",
        reason: "Persisted classification candidate request",
        idempotencyKey: receiptId,
        fingerprint: key,
        revision: current.revision + 1,
      });
      row.candidates.push(candidate);
      current.receipts.push({ itemId, candidate: this.receiptCandidate(candidate) });
      return candidate;
    });
    if (
      acquired.receiptId !== receiptId ||
      !useModel ||
      !prepared ||
      !definition.modelPolicy ||
      !this.options.classifyText
    )
      return release(acquired);
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, run.limits.timeoutMs);
    let final: EnrichmentCandidate;
    let cause: unknown;
    let dispatched = false;
    try {
      // The persisted claim precedes transmission. No automatic SDK retries are permitted.
      if (signal?.aborted) controller.abort();
      if (controller.signal.aborted) fail("cancelled");
      await this.live(scope, run, item);
      await this.allow(scope, "classify");
      if (
        (await this.options.currentActor(scope)) !== actor ||
        (await this.options.authorizationRevision(scope)) !== authorityRevision
      )
        fail("authority-changed");
      if (this.now() >= run.resultExpiresAt) fail("result-expired");
      if (this.now() >= run.rawExpiresAt) fail("raw-expired");
      if (controller.signal.aborted) fail("cancelled");
      const cancellation = new Promise<never>((_resolve, reject) =>
        controller.signal.addEventListener(
          "abort",
          () => reject(new EnrichmentProblem("acceptance-unknown")),
          { once: true },
        ),
      );
      dispatched = true;
      const response = await Promise.race([
        this.options.classifyText({
          ...prepared,
          allowedLabels: definition.labels,
          instructions: definition.modelPolicy.instructions,
          modelRef: definition.modelPolicy.modelRef,
          signal: controller.signal,
          limits: run.limits,
        }),
        cancellation,
      ]);
      const measured = usage(response.usage);
      cause = response.cause;
      const base = {
        ...candidate,
        usage: measured,
        ...(identifier(response.providerRequestRef)
          ? { providerRequestRef: response.providerRequestRef }
          : {}),
      };
      if (response.modelRef !== definition.modelPolicy.modelRef)
        final = { ...base, state: "failed", reason: "model-mismatch" };
      else if (
        measured.kind !== "unknown" &&
        (measured.outputTokens > run.limits.maxOutputTokens ||
          measured.inputTokens + measured.outputTokens > run.limits.tokensPerRequest)
      )
        final = { ...base, state: "failed", reason: "token-budget" };
      else if (response.completion !== "complete")
        final = {
          ...base,
          state: response.completion === "failed" ? "failed" : "unknown",
          reason: ["failed", "truncated", "refused"].includes(response.completion)
            ? response.completion
            : "invalid-completion",
        };
      else if (
        typeof response.json !== "string" ||
        bytes(response.json) > run.limits.maxOutputBytes
      )
        final = { ...base, state: "failed", reason: "output-budget" };
      else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(response.json);
        } catch {
          parsed = undefined;
        }
        const labelId =
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed) &&
          Object.keys(parsed).length === 1 &&
          "labelId" in parsed
            ? parsed.labelId
            : undefined;
        final =
          typeof labelId === "string" && definition.labels.some((label) => label.id === labelId)
            ? { ...base, state: "classified", labelId }
            : {
                ...base,
                state: "unknown",
                reason: labelId === null ? "no-label" : "invalid-output",
              };
      }
    } catch (error) {
      cause = error;
      final = dispatched
        ? { ...candidate, state: "failed", reason: "acceptance-unknown" }
        : {
            ...candidate,
            state: "failed",
            reason: "not-transmitted",
            usage: { kind: "known", inputTokens: 0, outputTokens: 0 },
          };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
    await this.mutate(scope, runId, (current) => {
      const row = current.items.find((entry) => entry.input.itemId === itemId) ?? fail("not-found");
      const index = row.candidates.findIndex((entry) => entry.receiptId === receiptId);
      const receipt =
        current.receipts.find((entry) => entry.candidate.receiptId === receiptId) ??
        fail("conflict");
      if (receipt.candidate.state !== "running") fail("conflict");
      receipt.candidate = this.receiptCandidate(final);
      if (final.usage.kind !== "unknown") {
        const excess = Math.max(
          0,
          final.usage.inputTokens + final.usage.outputTokens - current.limits.tokensPerRequest,
        );
        current.reservedTokens = Math.min(Number.MAX_SAFE_INTEGER, current.reservedTokens + excess);
      }
      if (index >= 0) row.candidates[index] = final;
    });
    const released = await release(final);
    if (cause && final.state === "failed") {
      if (!dispatched && cause instanceof EnrichmentProblem) throw cause;
      throw new EnrichmentProblem(
        final.reason === "failed" ? "provider-failed" : "acceptance-unknown",
        cause,
      );
    }
    return released;
  }
  private async live(
    scope: EnrichmentScope,
    run: EnrichmentRun,
    item: EnrichmentRun["items"][number],
  ): Promise<void> {
    if (this.now() >= run.resultExpiresAt) fail("result-expired");
    if (
      !(await this.options.sourceAvailable(scope, item.input.sourceRef, item.input.inputRevision))
    )
      fail("source-unavailable");
    if (this.now() >= run.resultExpiresAt) fail("result-expired");
  }
  async read(
    scope: EnrichmentScope,
    runId: string,
    offset = 0,
    limit = 20,
  ): Promise<EnrichmentPage> {
    await this.allow(scope, "read");
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 50
    )
      fail("invalid-page");
    const run = await this.load(scope, runId);
    const sources: { row: EnrichmentRun["items"][number]; available: boolean }[] = [];
    for (const row of run.items.slice(offset, offset + limit)) {
      const available = await this.options.sourceAvailable(
        scope,
        row.input.sourceRef,
        row.input.inputRevision,
      );
      sources.push({ row, available });
    }
    // Project the entire page after all asynchronous source checks finish.
    const resultExpired = this.now() >= run.resultExpiresAt;
    const rawExpired = this.now() >= run.rawExpiresAt;
    const items: EnrichmentItem[] = sources.map(({ row, available }) => ({
      itemId: row.input.itemId,
      inputRevision: row.input.inputRevision,
      sourceRef: row.input.sourceRef,
      availability: !available
        ? "deleted"
        : resultExpired
          ? "result-expired"
          : rawExpired
            ? "raw-expired"
            : "available",
      original: available && !rawExpired && !resultExpired ? row.input.text : null,
      candidates: available && !resultExpired ? row.candidates : [],
      reviewHistory: available && !resultExpired ? row.reviews.slice(-20) : [],
      ...(available && !resultExpired && row.review ? { review: row.review } : {}),
    }));
    const status = items.some(
      (item) => item.availability === "deleted" || item.availability === "result-expired",
    )
      ? "partial"
      : run.items.every((item) => item.review)
        ? "reviewed"
        : run.items.some((item) =>
              item.candidates.some(
                (candidate) => candidate.state === "failed" || candidate.state === "unknown",
              ),
            )
          ? "partial"
          : run.items.every((item) => item.candidates.length)
            ? "review-required"
            : "pending";
    return {
      runId,
      revision: run.revision,
      items,
      nextOffset: offset + limit < run.items.length ? offset + limit : null,
      requests: run.requests,
      reservedTokens: run.reservedTokens,
      status,
    };
  }
  private command(
    run: EnrichmentRun,
    command: EnrichmentCommand,
    action: string,
    payload: unknown,
  ): boolean {
    if (
      !identifier(command.actor) ||
      !identifier(command.idempotencyKey) ||
      typeof command.reason !== "string" ||
      !command.reason.trim() ||
      command.reason.length > 500 ||
      !Number.isSafeInteger(command.expectedRevision)
    )
      fail("invalid-command");
    const fingerprint = hash([command.actor, command.reason, action, payload]);
    const duplicate = run.audit.find((entry) => entry.idempotencyKey === command.idempotencyKey);
    if (duplicate) {
      if (duplicate.fingerprint !== fingerprint) fail("idempotency-conflict");
      return false;
    }
    if (command.expectedRevision !== run.revision) fail("conflict");
    if (run.audit.length >= 1000) fail("audit-limit");
    run.audit.push({
      actor: command.actor,
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
      action,
      fingerprint,
      revision: run.revision + 1,
    });
    return true;
  }
  async review(
    scope: EnrichmentScope,
    runId: string,
    itemId: string,
    definitionId: string,
    version: string,
    labelId: string,
    evidence: string,
    command: EnrichmentCommand,
  ): Promise<EnrichmentPage> {
    await this.allow(scope, "review", command.actor);
    const definition = this.definition(definitionId, version);
    if (
      !definition.labels.some((label) => label.id === labelId) ||
      typeof evidence !== "string" ||
      !evidence.trim() ||
      evidence.length > 1000
    )
      fail("invalid-review");
    const current = await this.load(scope, runId);
    const item = current.items.find((row) => row.input.itemId === itemId) ?? fail("not-found");
    await this.live(scope, current, item);
    await this.mutate(scope, runId, (run) => {
      if (!this.command(run, command, "review", [itemId, definitionId, version, labelId, evidence]))
        return;
      const row = run.items.find((entry) => entry.input.itemId === itemId) ?? fail("not-found");
      const candidate = row.candidates
        .filter(
          (entry) => entry.definitionId === definitionId && entry.definitionVersion === version,
        )
        .at(-1);
      if (candidate?.state === "running") fail("candidate-running");
      if (!candidate && (row.input.text === null || this.now() >= run.rawExpiresAt))
        fail("raw-expired");
      row.review = {
        labelId,
        evidence,
        actor: command.actor,
        reason: command.reason,
        revision: run.revision + 1,
        candidateRef: candidate?.receiptId ?? null,
        definitionVersion: version,
        definitionId,
      };
      row.reviews.push(row.review);
    });
    return this.read(scope, runId);
  }
  async exportLabels(
    scope: EnrichmentScope,
    runId: string,
    definitionId: string,
    version: string,
    command: EnrichmentCommand,
  ): Promise<
    readonly { itemId: string; inputRevision: string; labelId: string; reviewRevision: number }[]
  > {
    await this.allow(scope, "export", command.actor);
    const definition = this.definition(definitionId, version);
    const current = await this.load(scope, runId);
    for (const item of current.items) await this.live(scope, current, item);
    const exported = await this.mutate(scope, runId, (run) => {
      if (this.now() >= run.resultExpiresAt) fail("result-expired");
      const fresh = this.command(run, command, "export", [definitionId, version]);
      if (!fresh) {
        const prior =
          run.audit.find((entry) => entry.idempotencyKey === command.idempotencyKey)?.exported ??
          fail("conflict");
        if (prior.some((item) => !definition.labels.some((label) => label.id === item.labelId)))
          fail("review-required");
        return prior;
      }
      const exported = run.items.map((item) => {
        const review = item.review ?? fail("review-required");
        if (
          review.definitionId !== definitionId ||
          !definition.labels.some((label) => label.id === review.labelId)
        )
          fail("review-required");
        return {
          itemId: item.input.itemId,
          inputRevision: item.input.inputRevision,
          labelId: review.labelId,
          reviewRevision: review.revision,
        };
      });
      const index = run.audit.length - 1;
      run.audit[index] = { ...run.audit[index], exported };
      return exported;
    });
    // CAS or source/authorization checks may wait across the retention deadline.
    const latest = await this.load(scope, runId);
    for (const item of latest.items) await this.live(scope, latest, item);
    await this.allow(scope, "export", command.actor);
    if (this.now() >= latest.resultExpiresAt) fail("result-expired");
    return exported;
  }
  /** Explicit stopped-worker acknowledgement; retries remain subject to the original attempt limit. */
  async retry(
    scope: EnrichmentScope,
    runId: string,
    itemId: string,
    receiptId: string,
    acknowledgeDuplicateBilling: boolean,
    command: EnrichmentCommand,
  ): Promise<void> {
    await this.allow(scope, "classify", command.actor);
    const snapshot = await this.load(scope, runId);
    const prior =
      snapshot.receipts.find(
        (entry) => entry.itemId === itemId && entry.candidate.receiptId === receiptId,
      )?.candidate ?? fail("conflict");
    // Reconcile operational claims even after source deletion or result retention. This
    // acknowledgement returns no result and never recreates a purged candidate.
    if (prior.reason !== "acceptance-unknown" && prior.state !== "running")
      await this.live(
        scope,
        snapshot,
        snapshot.items.find((item) => item.input.itemId === itemId) ?? fail("not-found"),
      );
    await this.mutate(scope, runId, (run) => {
      if (!this.command(run, command, "retry", [itemId, receiptId, acknowledgeDuplicateBilling]))
        return;
      const row = run.items.find((item) => item.input.itemId === itemId) ?? fail("not-found");
      const index = row.candidates.findIndex((item) => item.receiptId === receiptId);
      const receipt =
        run.receipts.find(
          (entry) => entry.itemId === itemId && entry.candidate.receiptId === receiptId,
        ) ?? fail("conflict");
      const candidate = receipt.candidate;
      const uncertain = candidate.reason === "acceptance-unknown" || candidate.state === "running";
      if (index !== row.candidates.length - 1 && !uncertain) fail("conflict");
      if (
        candidate.state === "classified" ||
        (candidate.state === "running" && (candidate.leaseUntil ?? Infinity) > this.now()) ||
        candidate.retryAuthorized
      )
        fail("retry-unavailable");
      if (uncertain && !acknowledgeDuplicateBilling)
        fail("duplicate-billing-acknowledgement-required");
      if (candidate.attempt >= run.limits.maxAttempts && !uncertain) fail("attempt-limit");
      // The trusted operator confirms that the old worker has stopped. At the final attempt
      // this only releases the uncertain slot; classify still rejects an additional attempt.
      const acknowledged: EnrichmentCandidate = {
        ...candidate,
        ...(candidate.state === "running" ? { state: "failed", reason: "acceptance-unknown" } : {}),
        retryAuthorized: true,
      };
      receipt.candidate = acknowledged;
      if (index >= 0) row.candidates[index] = { ...row.candidates[index], ...acknowledged };
    });
  }
  /** Retries only pending event/usage intents; model calls are never part of settlement. */
  async settle(scope: EnrichmentScope, runId: string): Promise<void> {
    await this.allow(scope, "classify");
    const run = await this.load(scope, runId);
    for (const { itemId, candidate } of run.receipts) {
      if (candidate.state === "running" || candidate.delivery === "delivered") continue;
      try {
        await this.options.settle({ scope: run.scope, runId, itemId, candidate });
      } catch (cause) {
        throw new EnrichmentProblem("settlement-failed", cause);
      }
      await this.mutate(scope, runId, (current) => {
        const receipt =
          current.receipts.find((entry) => entry.candidate.receiptId === candidate.receiptId) ??
          fail("conflict");
        receipt.candidate = { ...receipt.candidate, delivery: "delivered" };
        const row =
          current.items.find((entry) => entry.input.itemId === itemId) ?? fail("not-found");
        const index = row.candidates.findIndex((entry) => entry.receiptId === candidate.receiptId);
        if (index >= 0) row.candidates[index] = { ...row.candidates[index], delivery: "delivered" };
      });
    }
  }
  private receiptCandidate(candidate: EnrichmentCandidate): EnrichmentCandidate {
    const { labelId: _label, ...receipt } = candidate;
    return receipt;
  }
  /** Apply retention/deletion physically; the read and export paths already fail closed. */
  async purge(scope: EnrichmentScope, runId: string): Promise<void> {
    await this.allow(scope, "purge");
    const actor = await this.options.currentActor(scope);
    if (!identifier(actor)) fail("invalid-actor");
    const run = await this.load(scope, runId);
    const deleted = new Set<string>();
    for (const item of run.items)
      if (
        !(await this.options.sourceAvailable(scope, item.input.sourceRef, item.input.inputRevision))
      )
        deleted.add(item.input.itemId);
    await this.mutate(scope, runId, (current) => {
      const before = JSON.stringify([current.items, current.audit]);
      current.audit = current.audit.map((entry) => {
        const { exported, ...audit } = entry;
        return exported && deleted.size === 0 && this.now() < current.resultExpiresAt
          ? entry
          : audit;
      });
      for (const item of current.items) {
        if (deleted.has(item.input.itemId) || this.now() >= current.rawExpiresAt) {
          item.input.text = null;
          item.input.context = {};
        }
        if (deleted.has(item.input.itemId) || this.now() >= current.resultExpiresAt) {
          item.candidates = [];
          delete item.review;
          item.reviews = [];
        }
      }
      if (JSON.stringify([current.items, current.audit]) !== before) {
        const fingerprint = hash([
          Array.from(deleted).sort(),
          this.now() >= current.rawExpiresAt,
          this.now() >= current.resultExpiresAt,
        ]);
        current.retentionAudit.push({
          actor,
          action: "purge",
          reason: "Applied current source deletion and retention policy",
          revision: current.revision + 1,
          fingerprint,
          idempotencyKey: fingerprint,
        });
      }
    });
  }
}
