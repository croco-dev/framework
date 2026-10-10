import { Problem, ProblemCategory } from "@croco/problems-core";
import type { MetricDefinitionIdentity, MetricWindow } from "../metric/MetricExpression";

export type { MetricDefinitionIdentity, MetricWindow } from "../metric/MetricExpression";
export type SourceRevision = { readonly sourceRef: string; readonly revision: string };
export type MetricPrincipal = {
  readonly app: string;
  readonly environment: string;
  readonly tenant: string;
  readonly subject: string;
};
export type MetricReadBudget = {
  readonly maxWindowMs: number;
  readonly maxRows: number;
  readonly maxBytes: number;
  readonly maxTimeMs: number;
  readonly maxConcurrency: number;
  readonly maxCost: number;
};
export type MetricReadContext = {
  readonly principal: MetricPrincipal;
  readonly allowedFields: readonly string[];
  readonly allowRaw: boolean;
  readonly budget: MetricReadBudget;
  readonly sourceRevisions: readonly SourceRevision[];
  /** Snapshot references correspond to sourceRevisions in the same order. */
  readonly snapshotRefs: readonly string[];
  readonly signal?: AbortSignal;
};
export type MetricReadGrant = {
  readonly permissionEpoch: string;
  readonly privacyEpoch: string;
};
export type MetricReadAction = {
  readonly definitionIds: readonly string[];
  readonly requiredFields: readonly string[];
  readonly requiresRaw: boolean;
  readonly window?: MetricWindow;
};
export type MetricReadAuthority = {
  currentContext(): MetricReadContext;
  authorize(context: MetricReadContext, action: MetricReadAction): Promise<MetricReadGrant | null>;
};
export type MetricReadQuality = {
  readonly temporalCompleteness: "complete" | "partial";
  readonly freshness: "fresh" | "stale";
  readonly populationCoverage: "complete" | "partial";
  readonly validity: "valid" | "invalid";
  readonly exactness: "exact" | "approximate";
  readonly reproducibility: "reproducible" | "unverified";
};
export type MetricReadResult = {
  readonly data: unknown;
  readonly principal: MetricPrincipal;
  readonly definition: MetricDefinitionIdentity;
  readonly unit: string;
  readonly population: string;
  readonly filter: string;
  readonly fieldRefs: readonly string[];
  readonly window: MetricWindow;
  readonly sourceRevisions: readonly SourceRevision[];
  readonly snapshotRefs: readonly string[];
  readonly quality: MetricReadQuality;
  /** Stable machine codes only; never raw source values or free-form error text. */
  readonly diagnostics: readonly string[];
  readonly numerator?: string;
  readonly denominator?: string;
  readonly rows: number;
  readonly bytes: number;
  readonly cost: number;
};
export type VerifiedMetricReport = {
  readonly id: string;
  readonly queryId: string;
  readonly queryVersion: number;
  readonly inputKey: string;
  readonly resultHash: string;
  readonly result: MetricReadResult;
  readonly reviewed: {
    readonly reviewerId: string;
    readonly reviewedAt: string;
    readonly definitionHash: string;
    readonly resultHash: string;
  };
  readonly permissionEpoch: string;
  readonly privacyEpoch: string;
  readonly expiresAt: string;
};
export type VerifiedReportReader = {
  readCandidates(
    queryId: string,
    inputKey: string,
    principal: MetricPrincipal,
    signal?: AbortSignal,
  ): Promise<readonly VerifiedMetricReport[]>;
  /** Must verify the review provenance and the digest of the actual result payload. */
  verify(report: VerifiedMetricReport, signal?: AbortSignal): Promise<boolean>;
};
export type RegisteredMetricQuery = {
  readonly id: string;
  readonly version: number;
  readonly definitionRefs: readonly string[];
  readonly unit: string;
  readonly population: string;
  readonly filter: string;
  readonly requiredFields: readonly string[];
  readonly requiresRaw: boolean;
  /** Withhold partial data unless this registered query explicitly permits authorized partial results. */
  readonly partialDataPolicy?: "withhold" | "authorized";
  readonly limits: MetricReadBudget;
  readonly inputSchema: { parse(input: unknown): unknown };
  readonly outputSchema: { parse(output: unknown): unknown };
  readonly inputKey: (input: unknown) => string | Promise<string>;
  readonly readExecutor: (request: {
    readonly input: unknown;
    readonly window: MetricWindow;
    readonly context: MetricReadContext;
    readonly signal: AbortSignal;
  }) => Promise<MetricReadResult>;
};
export type RegisteredMetricQueryDescription = Pick<
  RegisteredMetricQuery,
  | "id"
  | "version"
  | "definitionRefs"
  | "unit"
  | "population"
  | "filter"
  | "requiredFields"
  | "requiresRaw"
  | "limits"
>;
export type MetricDefinitionExplanation = {
  readonly definition: MetricDefinitionIdentity;
  readonly description: string;
  readonly requiredFields: readonly string[];
  readonly requiresRaw: boolean;
};
export type RegisteredMetricDefinition = MetricDefinitionIdentity & {
  readonly description: string;
  readonly requiredFields: readonly string[];
  readonly requiresRaw: boolean;
};
export type MetricReadEvidence = Omit<
  MetricReadResult,
  "data" | "principal" | "rows" | "bytes" | "cost"
>;
export type VerifiedReportOutcome =
  | { readonly status: "verified"; readonly report: VerifiedMetricReport }
  | {
      readonly status: "partial";
      readonly reportId: string;
      readonly evidence: MetricReadEvidence;
      readonly result?: MetricReadResult;
    }
  | { readonly status: "stale"; readonly reportId: string; readonly evidence: MetricReadEvidence }
  | { readonly status: "denied" | "unavailable"; readonly reportId?: string };
export type RegisteredQueryOutcome =
  | {
      readonly status: "verified";
      readonly source: "report" | "executor";
      readonly result: MetricReadResult;
    }
  | {
      readonly status: "partial";
      readonly evidence: MetricReadEvidence;
      readonly reportId?: string;
      readonly result?: MetricReadResult;
    }
  | { readonly status: "stale"; readonly reportId?: string; readonly evidence: MetricReadEvidence }
  | { readonly status: "denied" | "unavailable"; readonly reportId?: string };
export type RegisteredQueryReadOptions = {
  readonly expectedVersion?: number;
  readonly signal?: AbortSignal;
};
export type MetricReadAuditEvent = {
  readonly queryId: string;
  readonly sourceRefs: readonly string[];
  readonly at: string;
  readonly status: RegisteredQueryOutcome["status"] | "error";
};

export class MetricReadProblem extends Problem {
  readonly code: string;
  readonly category: ProblemCategory;

  constructor(code: string, category: ProblemCategory, detail: string) {
    super(code, category, detail);
    this.code = code;
    this.category = category;
  }
}

function cancelled(detail: string): MetricReadProblem {
  return new MetricReadProblem("metrics-core/read-cancelled", ProblemCategory.BadRequest, detail);
}

function timedOut(): MetricReadProblem {
  return new MetricReadProblem(
    "metrics-core/read-timeout",
    ProblemCategory.BadRequest,
    "Metric read timed out",
  );
}

function fail(code: string, category: ProblemCategory, detail: string): never {
  throw new MetricReadProblem(`metrics-core/${code}`, category, detail);
}

function validWindow(window: MetricWindow): boolean {
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  return (
    Number.isFinite(from) &&
    Number.isFinite(to) &&
    from < to &&
    new Date(from).toISOString() === window.from &&
    new Date(to).toISOString() === window.to
  );
}

function samePrincipal(left: MetricPrincipal, right: MetricPrincipal): boolean {
  return (
    left.app === right.app &&
    left.environment === right.environment &&
    left.tenant === right.tenant &&
    left.subject === right.subject
  );
}

function sameIdentity(left: MetricDefinitionIdentity, right: MetricDefinitionIdentity): boolean {
  return (
    left.id === right.id &&
    left.version === right.version &&
    left.hash === right.hash &&
    left.unit === right.unit &&
    left.population === right.population &&
    sameStrings(left.sourceRefs, right.sourceRefs)
  );
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameRevisions(left: readonly SourceRevision[], right: readonly SourceRevision[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (value, index) =>
        value.sourceRef === right[index]?.sourceRef && value.revision === right[index]?.revision,
    )
  );
}

function sufficientQuality(quality: MetricReadQuality): boolean {
  return (
    quality.temporalCompleteness === "complete" &&
    quality.freshness === "fresh" &&
    quality.populationCoverage === "complete" &&
    quality.validity === "valid" &&
    quality.exactness === "exact" &&
    quality.reproducibility === "reproducible"
  );
}

function metricEvidence(result: MetricReadResult): MetricReadEvidence {
  return {
    definition: result.definition,
    unit: result.unit,
    population: result.population,
    filter: result.filter,
    fieldRefs: result.fieldRefs,
    window: result.window,
    sourceRevisions: result.sourceRevisions,
    snapshotRefs: result.snapshotRefs,
    quality: result.quality,
    diagnostics: result.diagnostics,
    ...(result.numerator === undefined ? {} : { numerator: result.numerator }),
    ...(result.denominator === undefined ? {} : { denominator: result.denominator }),
  };
}

function positiveBudget(budget: MetricReadBudget): boolean {
  return (
    Object.values(budget).every((value) => Number.isFinite(value) && value > 0) &&
    Number.isSafeInteger(budget.maxWindowMs) &&
    Number.isSafeInteger(budget.maxRows) &&
    Number.isSafeInteger(budget.maxBytes) &&
    Number.isSafeInteger(budget.maxTimeMs) &&
    Number.isSafeInteger(budget.maxConcurrency)
  );
}

export class MetricReadService {
  private readonly definitions: ReadonlyMap<string, RegisteredMetricDefinition>;
  private readonly queries: ReadonlyMap<string, RegisteredMetricQuery>;
  private readonly audit: MetricReadAuditEvent[] = [];
  private active = 0;

  constructor(
    definitions: readonly RegisteredMetricDefinition[],
    queries: readonly RegisteredMetricQuery[],
    private readonly authority: MetricReadAuthority,
    private readonly reports?: VerifiedReportReader,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (
      new Set(definitions.map((definition) => definition.id)).size !== definitions.length ||
      new Set(queries.map((query) => query.id)).size !== queries.length
    ) {
      fail(
        "duplicate-registration",
        ProblemCategory.Conflict,
        "Metric definition and query IDs must be unique",
      );
    }
    for (const query of queries) {
      if (
        query.definitionRefs.length !== 1 ||
        query.definitionRefs.some((id) => !definitions.some((definition) => definition.id === id))
      ) {
        fail(
          "invalid-registration",
          ProblemCategory.ValidationError,
          "Each query must reference exactly one registered definition",
        );
      }
      if (!positiveBudget(query.limits)) {
        fail(
          "invalid-registration",
          ProblemCategory.ValidationError,
          "Query limits must be positive finite values",
        );
      }
      const primary = definitions.find((definition) => definition.id === query.definitionRefs[0]);
      if (
        primary &&
        (primary.requiredFields.some((field) => !query.requiredFields.includes(field)) ||
          (primary.requiresRaw && !query.requiresRaw))
      ) {
        fail(
          "invalid-registration",
          ProblemCategory.ValidationError,
          "Query permissions must cover its definitions",
        );
      }
      if (primary && (query.unit !== primary.unit || query.population !== primary.population)) {
        fail(
          "invalid-registration",
          ProblemCategory.ValidationError,
          "Query unit and population must match its primary definition",
        );
      }
    }
    this.definitions = new Map(
      definitions.map((definition) => [
        definition.id,
        Object.freeze({
          ...definition,
          sourceRefs: Object.freeze([...definition.sourceRefs]),
          requiredFields: Object.freeze([...definition.requiredFields]),
        }),
      ]),
    );
    this.queries = new Map(
      queries.map((query) => [
        query.id,
        Object.freeze({
          ...query,
          definitionRefs: Object.freeze([...query.definitionRefs]),
          requiredFields: Object.freeze([...query.requiredFields]),
          limits: Object.freeze({ ...query.limits }),
        }),
      ]),
    );
  }

  getAuditEvents(): readonly MetricReadAuditEvent[] {
    return this.audit.map((event) => ({ ...event, sourceRefs: [...event.sourceRefs] }));
  }

  async listDefinitions(signal?: AbortSignal): Promise<readonly MetricDefinitionIdentity[]> {
    const context = this.readContext(signal);
    const deadline = Date.now() + context.budget.maxTimeMs;
    const candidates: {
      definition: RegisteredMetricDefinition;
      action: MetricReadAction;
      grant: MetricReadGrant;
    }[] = [];
    for (const definition of this.definitions.values()) {
      const action = this.action(definition);
      const grant = await this.grant(context, action, deadline);
      if (grant) candidates.push({ definition, action, grant });
    }
    const current = await Promise.all(
      candidates.map(({ action, grant }) => this.currentGrant(context, action, grant, deadline)),
    );
    return candidates
      .filter((_, index) => current[index])
      .map(({ definition }) => ({
        id: definition.id,
        version: definition.version,
        hash: definition.hash,
        unit: definition.unit,
        population: definition.population,
        sourceRefs: definition.sourceRefs,
      }));
  }

  async listRegisteredQueries(
    signal?: AbortSignal,
  ): Promise<readonly RegisteredMetricQueryDescription[]> {
    const context = this.readContext(signal);
    const deadline = Date.now() + context.budget.maxTimeMs;
    const candidates: {
      query: RegisteredMetricQuery;
      action: MetricReadAction;
      grant: MetricReadGrant;
    }[] = [];
    for (const query of this.queries.values()) {
      const action = this.action(this.definition(query), query);
      const grant = await this.grant(context, action, deadline);
      if (grant) candidates.push({ query, action, grant });
    }
    const current = await Promise.all(
      candidates.map(({ action, grant }) => this.currentGrant(context, action, grant, deadline)),
    );
    return candidates
      .filter((_, index) => current[index])
      .map(({ query }) => ({
        id: query.id,
        version: query.version,
        definitionRefs: query.definitionRefs,
        unit: query.unit,
        population: query.population,
        filter: query.filter,
        requiredFields: query.requiredFields,
        requiresRaw: query.requiresRaw,
        limits: query.limits,
      }));
  }

  async explainDefinition(
    id: string,
    signal?: AbortSignal,
  ): Promise<MetricDefinitionExplanation | { readonly status: "denied" | "unavailable" }> {
    const definition = this.definitions.get(id);
    if (!definition) return { status: "unavailable" };
    const context = this.readContext(signal);
    const deadline = Date.now() + context.budget.maxTimeMs;
    const action = this.action(definition);
    const grant = await this.grant(context, action, deadline);
    if (!grant) return { status: "denied" };
    if (!(await this.currentGrant(context, action, grant, deadline))) return { status: "denied" };
    return {
      definition,
      description: definition.description,
      requiredFields: definition.requiredFields,
      requiresRaw: definition.requiresRaw,
    };
  }

  async getVerifiedReport(
    queryId: string,
    input: unknown,
    window: MetricWindow,
    signal?: AbortSignal,
  ): Promise<VerifiedReportOutcome> {
    const query = this.queries.get(queryId);
    if (!query) return { status: "unavailable" };
    this.checkWindow(window);
    const parsed = this.parseInput(query, input);
    const context = this.readContext(signal);
    const deadline = Date.now() + Math.min(context.budget.maxTimeMs, query.limits.maxTimeMs);
    const definition = this.definition(query);
    const action = this.action(definition, query, window);
    let status: MetricReadAuditEvent["status"] = "error";
    try {
      const grant = await this.grant(context, action, deadline);
      if (!grant) return { status: (status = "denied") };
      this.checkBudget(context.budget, query.limits, window);
      const outcome = await this.report(
        query,
        parsed,
        window,
        context,
        grant,
        definition,
        deadline,
      );
      if (!(await this.currentGrant(context, action, grant, deadline)))
        return { status: (status = "denied") };
      status = outcome.status;
      return outcome;
    } finally {
      this.record(query.id, definition.sourceRefs, status);
    }
  }

  async runRegisteredQuery(
    queryId: string,
    input: unknown,
    window: MetricWindow,
    options: RegisteredQueryReadOptions = {},
  ): Promise<RegisteredQueryOutcome> {
    const query = this.queries.get(queryId);
    if (!query) return { status: "unavailable" };
    if (options.expectedVersion !== undefined && options.expectedVersion !== query.version)
      return { status: "unavailable" };
    this.checkWindow(window);
    const parsed = this.parseInput(query, input);
    const context = this.readContext(options.signal);
    const deadline = Date.now() + Math.min(context.budget.maxTimeMs, query.limits.maxTimeMs);
    const definition = this.definition(query);
    const action = this.action(definition, query, window);
    let status: RegisteredQueryOutcome["status"] | "error" = "error";
    try {
      const grant = await this.grant(context, action, deadline);
      if (!grant) return { status: (status = "denied") };
      this.checkBudget(context.budget, query.limits, window);
      const sources = this.scopedSources(query, context);
      const report = await this.report(query, parsed, window, context, grant, definition, deadline);
      if (!(await this.currentGrant(context, action, grant, deadline)))
        return { status: (status = "denied") };
      if (report.status === "verified") {
        status = "verified";
        return { status, source: "report", result: report.report.result };
      }
      if (report.status === "partial")
        return {
          status: (status = "partial"),
          reportId: report.reportId,
          evidence: report.evidence,
          ...(report.result ? { result: report.result } : {}),
        };
      if (report.status === "denied")
        return { status: (status = "denied"), reportId: report.reportId };
      if (this.active >= Math.min(context.budget.maxConcurrency, query.limits.maxConcurrency)) {
        fail(
          "concurrency-budget-exceeded",
          ProblemCategory.TooManyRequests,
          "Concurrent metric reads exceed the authorized budget",
        );
      }
      this.checkDeadline(deadline);
      const controller = new AbortController();
      const onAbort = () => controller.abort(cancelled("Metric read was cancelled"));
      context.signal?.addEventListener("abort", onAbort, { once: true });
      const timeout = setTimeout(() => controller.abort(timedOut()), deadline - Date.now());
      try {
        this.checkAbort(context.signal);
        this.active++;
        const effectiveContext: MetricReadContext = {
          ...context,
          ...sources,
          budget: {
            maxWindowMs: Math.min(context.budget.maxWindowMs, query.limits.maxWindowMs),
            maxRows: Math.min(context.budget.maxRows, query.limits.maxRows),
            maxBytes: Math.min(context.budget.maxBytes, query.limits.maxBytes),
            maxTimeMs: Math.min(context.budget.maxTimeMs, query.limits.maxTimeMs),
            maxConcurrency: Math.min(context.budget.maxConcurrency, query.limits.maxConcurrency),
            maxCost: Math.min(context.budget.maxCost, query.limits.maxCost),
          },
        };
        const execution = Promise.resolve().then(() =>
          query.readExecutor({
            input: parsed,
            window,
            context: effectiveContext,
            signal: controller.signal,
          }),
        );
        void execution.then(
          () => {
            this.active--;
          },
          () => {
            this.active--;
          },
        );
        const result = await Promise.race([
          execution,
          new Promise<never>((_, reject) => {
            if (controller.signal.aborted) {
              reject(controller.signal.reason);
              return;
            }
            controller.signal.addEventListener("abort", () => reject(controller.signal.reason), {
              once: true,
            });
          }),
        ]);
        this.checkAbort(context.signal);
        this.checkDeadline(deadline);
        this.checkResult(result, query, definition, window, context);
        query.outputSchema.parse(result.data);
        if (!(await this.currentGrant(context, action, grant, deadline)))
          return { status: (status = "denied") };
        if (result.quality.freshness === "stale")
          return { status: (status = "stale"), evidence: metricEvidence(result) };
        if (!sufficientQuality(result.quality))
          return {
            status: (status = "partial"),
            evidence: metricEvidence(result),
            ...(query.partialDataPolicy === "authorized" ? { result } : {}),
          };
        status = "verified";
        return { status, source: "executor", result };
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        throw error;
      } finally {
        clearTimeout(timeout);
        context.signal?.removeEventListener("abort", onAbort);
      }
    } finally {
      this.record(query.id, definition.sourceRefs, status);
    }
  }

  private parseInput(query: RegisteredMetricQuery, input: unknown): unknown {
    try {
      return query.inputSchema.parse(input);
    } catch {
      return fail(
        "invalid-query-input",
        ProblemCategory.ValidationError,
        "Metric query input does not match its registered schema",
      );
    }
  }

  private definition(query: RegisteredMetricQuery): RegisteredMetricDefinition {
    const definition = this.definitions.get(query.definitionRefs[0] ?? "");
    if (!definition)
      return fail(
        "invalid-registration",
        ProblemCategory.InternalServerError,
        "Registered definition missing",
      );
    return definition;
  }

  private readContext(signal?: AbortSignal): MetricReadContext {
    const context = this.authority.currentContext();
    return {
      ...context,
      signal:
        context.signal && signal
          ? AbortSignal.any([context.signal, signal])
          : (context.signal ?? signal),
      principal: { ...context.principal },
      allowedFields: [...context.allowedFields],
      budget: { ...context.budget },
      sourceRevisions: context.sourceRevisions.map((revision) => ({ ...revision })),
      snapshotRefs: [...context.snapshotRefs],
    };
  }

  private action(
    definition: RegisteredMetricDefinition,
    query?: RegisteredMetricQuery,
    window?: MetricWindow,
  ): MetricReadAction {
    return {
      definitionIds: query?.definitionRefs ?? [definition.id],
      requiredFields: query?.requiredFields ?? definition.requiredFields,
      requiresRaw: query?.requiresRaw ?? definition.requiresRaw,
      window,
    };
  }

  private async grant(
    context: MetricReadContext,
    action: MetricReadAction,
    deadline: number,
  ): Promise<MetricReadGrant | null> {
    this.checkAbort(context.signal);
    this.checkDeadline(deadline);
    if (
      !context.principal.app ||
      !context.principal.environment ||
      !context.principal.tenant ||
      !context.principal.subject ||
      !positiveBudget(context.budget)
    ) {
      fail(
        "invalid-read-context",
        ProblemCategory.ValidationError,
        "Trusted read context is incomplete",
      );
    }
    if (
      (action.requiresRaw && !context.allowRaw) ||
      action.requiredFields.some((field) => !context.allowedFields.includes(field))
    ) {
      return null;
    }
    const grant = await this.withinDeadline(
      (signal) => this.authority.authorize({ ...context, signal }, action),
      deadline,
      context.signal,
    );
    this.checkAbort(context.signal);
    return grant;
  }

  private async currentGrant(
    context: MetricReadContext,
    action: MetricReadAction,
    original: MetricReadGrant,
    deadline: number,
  ): Promise<boolean> {
    const current = await this.grant(context, action, deadline);
    this.checkAbort(context.signal);
    return (
      current !== null &&
      current.permissionEpoch === original.permissionEpoch &&
      current.privacyEpoch === original.privacyEpoch
    );
  }

  private async report(
    query: RegisteredMetricQuery,
    input: unknown,
    window: MetricWindow,
    context: MetricReadContext,
    grant: MetricReadGrant,
    definition: RegisteredMetricDefinition,
    deadline: number,
  ): Promise<VerifiedReportOutcome> {
    if (!this.reports) return { status: "unavailable" };
    this.checkAbort(context.signal);
    if (this.active >= Math.min(context.budget.maxConcurrency, query.limits.maxConcurrency)) {
      fail(
        "concurrency-budget-exceeded",
        ProblemCategory.TooManyRequests,
        "Concurrent metric reads exceed the authorized budget",
      );
    }
    this.checkDeadline(deadline);
    const controller = new AbortController();
    const onAbort = () => controller.abort(cancelled("Metric read was cancelled"));
    context.signal?.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(timedOut()), deadline - Date.now());
    this.active++;
    const operation = this.matchReport(
      query,
      input,
      window,
      context,
      grant,
      definition,
      controller.signal,
    );
    void operation.then(
      () => {
        this.active--;
      },
      () => {
        this.active--;
      },
    );
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          if (controller.signal.aborted) {
            reject(controller.signal.reason);
            return;
          }
          controller.signal.addEventListener("abort", () => reject(controller.signal.reason), {
            once: true,
          });
        }),
      ]);
    } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason;
      throw error;
    } finally {
      clearTimeout(timeout);
      context.signal?.removeEventListener("abort", onAbort);
    }
  }

  private async matchReport(
    query: RegisteredMetricQuery,
    input: unknown,
    window: MetricWindow,
    context: MetricReadContext,
    grant: MetricReadGrant,
    definition: RegisteredMetricDefinition,
    signal: AbortSignal,
  ): Promise<VerifiedReportOutcome> {
    if (!this.reports) return { status: "unavailable" };
    const sources = this.scopedSources(query, context);
    const key = await query.inputKey(input);
    this.checkAbort(signal);
    const candidates = await this.reports.readCandidates(query.id, key, context.principal, signal);
    this.checkAbort(signal);
    let degraded: VerifiedReportOutcome = { status: "unavailable" };
    for (const report of candidates) {
      if (
        report.queryId !== query.id ||
        report.queryVersion !== query.version ||
        report.inputKey !== key ||
        !samePrincipal(report.result.principal, context.principal) ||
        !sameIdentity(report.result.definition, definition) ||
        report.result.unit !== query.unit ||
        report.result.population !== query.population ||
        report.result.filter !== query.filter ||
        !sameStrings(report.result.fieldRefs, query.requiredFields) ||
        report.result.window.from !== window.from ||
        report.result.window.to !== window.to ||
        !sameRevisions(report.result.sourceRevisions, sources.sourceRevisions) ||
        !sameStrings(report.result.snapshotRefs, sources.snapshotRefs) ||
        report.reviewed.definitionHash !== definition.hash ||
        report.reviewed.resultHash !== report.resultHash ||
        !report.reviewed.reviewerId ||
        !Number.isFinite(Date.parse(report.reviewed.reviewedAt))
      )
        continue;
      if (
        report.permissionEpoch !== grant.permissionEpoch ||
        report.privacyEpoch !== grant.privacyEpoch
      ) {
        degraded = { status: "denied", reportId: report.id };
        continue;
      }
      if (!(await this.reports.verify(report, signal))) continue;
      this.checkAbort(signal);
      this.checkDiagnostics(report.result.diagnostics);
      query.outputSchema.parse(report.result.data);
      if (!this.withinResultBudget(report.result, context.budget, query.limits)) {
        degraded = { status: "denied", reportId: report.id };
        continue;
      }
      if (
        !Number.isFinite(Date.parse(report.expiresAt)) ||
        Date.parse(report.expiresAt) <= this.now().getTime() ||
        report.result.quality.freshness === "stale"
      ) {
        degraded = {
          status: "stale",
          reportId: report.id,
          evidence: metricEvidence(report.result),
        };
        continue;
      }
      if (!sufficientQuality(report.result.quality)) {
        degraded = {
          status: "partial",
          reportId: report.id,
          evidence: metricEvidence(report.result),
          ...(query.partialDataPolicy === "authorized" ? { result: report.result } : {}),
        };
        continue;
      }
      return { status: "verified", report };
    }
    return degraded;
  }

  private checkResult(
    result: MetricReadResult,
    query: RegisteredMetricQuery,
    definition: RegisteredMetricDefinition,
    window: MetricWindow,
    context: MetricReadContext,
  ): void {
    const sources = this.scopedSources(query, context);
    this.checkDiagnostics(result.diagnostics);
    if (
      !samePrincipal(result.principal, context.principal) ||
      !sameIdentity(result.definition, definition) ||
      result.unit !== query.unit ||
      result.population !== query.population ||
      result.filter !== query.filter ||
      !sameStrings(result.fieldRefs, query.requiredFields) ||
      result.window.from !== window.from ||
      result.window.to !== window.to ||
      !sameRevisions(result.sourceRevisions, sources.sourceRevisions) ||
      !sameStrings(result.snapshotRefs, sources.snapshotRefs)
    ) {
      fail(
        "result-contract-mismatch",
        ProblemCategory.InternalServerError,
        "Executor returned a result outside its registered contract",
      );
    }
    if (!this.withinResultBudget(result, context.budget, query.limits)) {
      fail(
        "result-budget-exceeded",
        ProblemCategory.PayloadTooLarge,
        "Metric result exceeds its authorized budget",
      );
    }
  }

  private checkDiagnostics(diagnostics: readonly string[]): void {
    if (
      diagnostics.length > 16 ||
      diagnostics.some((code) => !/^[a-z][a-z0-9-]{0,63}$/.test(code))
    ) {
      fail(
        "invalid-diagnostics",
        ProblemCategory.InternalServerError,
        "Metric diagnostics must be bounded machine codes",
      );
    }
  }

  private scopedSources(
    query: RegisteredMetricQuery,
    context: MetricReadContext,
  ): Pick<MetricReadContext, "sourceRevisions" | "snapshotRefs"> {
    const required = this.definition(query).sourceRefs;
    if (context.sourceRevisions.length !== context.snapshotRefs.length) {
      fail(
        "invalid-read-context",
        ProblemCategory.ValidationError,
        "Source revisions and snapshots must correspond",
      );
    }
    if (
      new Set(context.sourceRevisions.map((revision) => revision.sourceRef)).size !==
      context.sourceRevisions.length
    ) {
      fail(
        "source-revision-missing",
        ProblemCategory.ValidationError,
        "Current source revisions do not match the definition",
      );
    }
    const sourceRevisions: SourceRevision[] = [];
    const snapshotRefs: string[] = [];
    for (const sourceRef of required) {
      const index = context.sourceRevisions.findIndex(
        (revision) => revision.sourceRef === sourceRef,
      );
      const revision = context.sourceRevisions[index];
      const snapshot = context.snapshotRefs[index];
      if (!revision || snapshot === undefined) {
        fail(
          "source-revision-missing",
          ProblemCategory.ValidationError,
          "Current source revisions do not match the definition",
        );
      }
      sourceRevisions.push(revision);
      snapshotRefs.push(snapshot);
    }
    return { sourceRevisions, snapshotRefs };
  }

  private withinResultBudget(
    result: MetricReadResult,
    context: MetricReadBudget,
    query: MetricReadBudget,
  ): boolean {
    return (
      [result.rows, result.bytes, result.cost].every(
        (value) => Number.isFinite(value) && value >= 0,
      ) &&
      result.rows <= Math.min(context.maxRows, query.maxRows) &&
      result.bytes <= Math.min(context.maxBytes, query.maxBytes) &&
      result.cost <= Math.min(context.maxCost, query.maxCost)
    );
  }

  private checkBudget(
    context: MetricReadBudget,
    query: MetricReadBudget,
    window: MetricWindow,
  ): void {
    if (!positiveBudget(context) || !positiveBudget(query)) {
      fail(
        "invalid-read-budget",
        ProblemCategory.ValidationError,
        "Metric read budgets must be positive finite values",
      );
    }
    if (
      Date.parse(window.to) - Date.parse(window.from) >
      Math.min(context.maxWindowMs, query.maxWindowMs)
    ) {
      fail(
        "window-budget-exceeded",
        ProblemCategory.ValidationError,
        "Metric window exceeds its authorized budget",
      );
    }
  }

  private checkDeadline(deadline: number): void {
    if (Date.now() >= deadline) throw timedOut();
  }

  private async withinDeadline<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    deadline: number,
    signal?: AbortSignal,
  ): Promise<T> {
    this.checkAbort(signal);
    this.checkDeadline(deadline);
    const controller = new AbortController();
    const onAbort = () => controller.abort(cancelled("Metric read was cancelled"));
    signal?.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(timedOut()), deadline - Date.now());
    let onOperationAbort: (() => void) | undefined;
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => {
          this.checkAbort(signal);
          this.checkDeadline(deadline);
          return operation(controller.signal);
        }),
        new Promise<never>((_, reject) => {
          onOperationAbort = () => reject(controller.signal.reason);
          controller.signal.addEventListener("abort", onOperationAbort, { once: true });
          if (signal?.aborted) onAbort();
        }),
      ]);
      this.checkAbort(signal);
      this.checkDeadline(deadline);
      return result;
    } catch (error) {
      if (signal?.aborted) onAbort();
      else if (Date.now() >= deadline) controller.abort(timedOut());
      if (controller.signal.aborted) throw controller.signal.reason;
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      if (onOperationAbort) controller.signal.removeEventListener("abort", onOperationAbort);
    }
  }

  private checkWindow(window: MetricWindow): void {
    if (!validWindow(window))
      fail(
        "invalid-window",
        ProblemCategory.ValidationError,
        "Metric window must be an ISO [from, to) interval",
      );
  }

  private checkAbort(signal?: AbortSignal): void {
    if (signal?.aborted) throw cancelled("Metric read was cancelled");
  }

  private record(
    queryId: string,
    sourceRefs: readonly string[],
    status: MetricReadAuditEvent["status"],
  ): void {
    this.audit.push({ queryId, sourceRefs: [...sourceRefs], at: this.now().toISOString(), status });
    if (this.audit.length > 256) this.audit.shift();
  }
}
