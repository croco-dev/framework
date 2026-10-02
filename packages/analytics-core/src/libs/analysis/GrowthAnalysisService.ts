import { Problem, ProblemCategory } from "@croco/problems-core";
import { canonicalFactValue } from "../FactHistory";

import type { MetricDefinitionIdentity } from "@croco/metrics-core";
import type { FactValue } from "../FactHistory";
import type { MetricReadResult, MetricReadService } from "@croco/metrics-core/runtime";
import type {
  AnalysisChoice,
  AnalysisFact,
  AnalysisModelLimits,
  AnalysisModelResponse,
  AnalysisOutcome,
  AnalysisPlan,
  AnalysisProposal,
  AnalysisUsage,
  ProposeAnalysisPlan,
} from "../GrowthAnalysis";

const ANALYSIS_PROBLEMS = {
  "analysis-invalid-usage": {
    code: "analytics-core/analysis-invalid-usage",
    category: ProblemCategory.ValidationError,
  },
  "analysis-invalid-plan": {
    code: "analytics-core/analysis-invalid-plan",
    category: ProblemCategory.ValidationError,
  },
  "analysis-invalid-limits": {
    code: "analytics-core/analysis-invalid-limits",
    category: ProblemCategory.ValidationError,
  },
  "analysis-invalid-question": {
    code: "analytics-core/analysis-invalid-question",
    category: ProblemCategory.ValidationError,
  },
  "analysis-question-blocked": {
    code: "analytics-core/analysis-question-blocked",
    category: ProblemCategory.Forbidden,
  },
  "analysis-input-budget-exceeded": {
    code: "analytics-core/analysis-input-budget-exceeded",
    category: ProblemCategory.ValidationError,
  },
  "analysis-concurrency-exceeded": {
    code: "analytics-core/analysis-concurrency-exceeded",
    category: ProblemCategory.TooManyRequests,
  },
  "analysis-cancelled": {
    code: "analytics-core/analysis-cancelled",
    category: ProblemCategory.BadRequest,
  },
  "analysis-invalid-completion": {
    code: "analytics-core/analysis-invalid-completion",
    category: ProblemCategory.ValidationError,
  },
  "analysis-provider-failed": {
    code: "analytics-core/analysis-provider-failed",
    category: ProblemCategory.InternalServerError,
  },
  "analysis-output-budget-exceeded": {
    code: "analytics-core/analysis-output-budget-exceeded",
    category: ProblemCategory.ValidationError,
  },
  "analysis-invalid-json": {
    code: "analytics-core/analysis-invalid-json",
    category: ProblemCategory.ValidationError,
  },
  "analysis-invalid-facts": {
    code: "analytics-core/analysis-invalid-facts",
    category: ProblemCategory.InternalServerError,
  },
  "analysis-invalid-registration": {
    code: "analytics-core/analysis-invalid-registration",
    category: ProblemCategory.ValidationError,
  },
} as const;

export type GrowthAnalysisProblemCode = keyof typeof ANALYSIS_PROBLEMS;

export class GrowthAnalysisProblem extends Problem {
  constructor(code: GrowthAnalysisProblemCode, cause?: Error) {
    const metadata = ANALYSIS_PROBLEMS[code];
    super(metadata.code, metadata.category, "Growth analysis could not complete", { cause });
  }
}

export type AnalysisRegistration = {
  readonly id: string;
  readonly label: string;
  readonly queryId: string;
  readonly version: number;
  readonly definitionId: string;
  readonly parameters: AnalysisPlan["parameters"];
  readonly window: AnalysisPlan["window"];
  readonly assumptions: readonly string[];
  /** Only a trusted server projection of already validated aggregate fields. Never raw rows. */
  readonly facts: (result: MetricReadResult) => readonly AnalysisFact[];
};

export type AnalysisModelReceipt = {
  readonly invocationId: string;
  readonly usage: AnalysisUsage;
  readonly completion: AnalysisModelResponse["completion"] | "unknown";
};

/** Server-only recovery handle. Repeating settlement does not repeat inference. */
export class AnalysisSettlementProblem extends Problem {
  constructor(
    cause: Error,
    private readonly recover: () => Promise<AnalysisProposal>,
  ) {
    super(
      "analytics-core/analysis-settlement-failed",
      ProblemCategory.InternalServerError,
      "Growth analysis usage could not be recorded",
      { cause },
    );
  }
  resume(): Promise<AnalysisProposal> {
    return this.recover();
  }
}

export type GrowthAnalysisServiceOptions = {
  /** Opaque server binding; never accept it from a model or use it to choose a principal. */
  readonly contextRef: () => string;
  /** Shared common runner; its authority resolves the authenticated context on every invocation. */
  readonly readService: Pick<MetricReadService, "listDefinitions" | "runRegisteredQuery">;
  readonly registrations: () => readonly AnalysisRegistration[];
  readonly proposeAnalysisPlan: ProposeAnalysisPlan;
  /** App policy must block or mask PII before any model call. Returning null rejects the request. */
  readonly prepareQuestion: (question: string) => string | null;
  readonly limits: AnalysisModelLimits;
  readonly invocationId: () => string;
  /** Use an idempotent execution/events/metering receipt sink, keyed by invocationId. */
  readonly settleUsage: (receipt: AnalysisModelReceipt) => Promise<void>;
};

const bytes = (value: string): number => new TextEncoder().encode(value).length;
const errorCause = (error: unknown): Error | undefined =>
  error instanceof Error ? error : undefined;
const sameDefinition = (left: MetricDefinitionIdentity, right: MetricDefinitionIdentity): boolean =>
  left.id === right.id &&
  left.version === right.version &&
  left.hash === right.hash &&
  left.unit === right.unit &&
  left.population === right.population &&
  left.sourceRefs.length === right.sourceRefs.length &&
  left.sourceRefs.every((ref, index) => ref === right.sourceRefs[index]);

function failure(code: GrowthAnalysisProblemCode): never {
  throw new GrowthAnalysisProblem(code);
}

function parseUsage(usage: AnalysisUsage): AnalysisUsage {
  if (!usage || typeof usage !== "object") failure("analysis-invalid-usage");
  if (usage.kind === "unknown") {
    if (Object.keys(usage).length !== 1) failure("analysis-invalid-usage");
    return { kind: "unknown" };
  }
  if (
    Object.keys(usage).length !== 3 ||
    !["known", "estimated"].includes(usage.kind) ||
    !Number.isSafeInteger(usage.inputTokens) ||
    usage.inputTokens < 0 ||
    !Number.isSafeInteger(usage.outputTokens) ||
    usage.outputTokens < 0
  )
    failure("analysis-invalid-usage");
  return { kind: usage.kind, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens };
}

function assertJsonValue(value: unknown): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || value === null) failure("analysis-invalid-plan");
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1)
      failure("analysis-invalid-plan");
    for (let index = 0; index < value.length; index++) {
      const property = Object.getOwnPropertyDescriptor(value, String(index));
      if (!property?.enumerable || !("value" in property)) failure("analysis-invalid-plan");
      assertJsonValue(property.value);
    }
    return;
  }
  if (prototype !== Object.prototype && prototype !== null) failure("analysis-invalid-plan");
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") failure("analysis-invalid-plan");
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property?.enumerable || !("value" in property)) failure("analysis-invalid-plan");
    assertJsonValue(property.value);
  }
}

function planKey(plan: AnalysisPlan): string {
  try {
    assertJsonValue(plan);
    return canonicalFactValue(plan as unknown as FactValue);
  } catch {
    return failure("analysis-invalid-plan");
  }
}

export class GrowthAnalysisService {
  private active = 0;
  constructor(private readonly options: GrowthAnalysisServiceOptions) {
    if (
      ["maxInputBytes", "maxOutputBytes", "maxOutputTokens", "maxTimeMs", "maxConcurrency"].some(
        (key) =>
          !Number.isSafeInteger(options.limits[key as keyof AnalysisModelLimits]) ||
          options.limits[key as keyof AnalysisModelLimits] <= 0,
      )
    )
      failure("analysis-invalid-limits");
  }

  async propose(question: string, signal?: AbortSignal): Promise<AnalysisProposal> {
    this.checkAbort(signal);
    if (
      typeof question !== "string" ||
      !question.trim() ||
      bytes(question) > this.options.limits.maxInputBytes
    )
      failure("analysis-invalid-question");
    const prepared = this.options.prepareQuestion(question);
    if (prepared === null) failure("analysis-question-blocked");
    if (!prepared.trim() || bytes(prepared) > this.options.limits.maxInputBytes)
      failure("analysis-invalid-question");
    const choices = await this.allowedChoices(signal);
    this.checkAbort(signal);
    if (!choices.length)
      return { status: "unavailable", reason: "no-definitions", usage: { kind: "unknown" } };
    const definitions = choices.map((choice) => choice.plan.metricDefinition);
    if (
      bytes(JSON.stringify({ question: prepared, allowedDefinitions: definitions, choices })) >
      this.options.limits.maxInputBytes
    )
      failure("analysis-input-budget-exceeded");
    if (this.active >= this.options.limits.maxConcurrency) failure("analysis-concurrency-exceeded");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, this.options.limits.maxTimeMs);
    const invocationId = this.options.invocationId();
    let receipt: AnalysisModelReceipt = {
      invocationId,
      usage: { kind: "unknown" },
      completion: "unknown",
    };
    let response: AnalysisModelResponse;
    this.active++;
    const execution = Promise.resolve().then(() =>
      this.options.proposeAnalysisPlan({
        question: prepared,
        allowedDefinitions: definitions,
        choices,
        signal: controller.signal,
        limits: this.options.limits,
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
    try {
      response = await Promise.race([
        execution,
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener(
            "abort",
            () => reject(new GrowthAnalysisProblem("analysis-cancelled")),
            { once: true },
          ),
        ),
      ]);
      response = { ...response, usage: parseUsage(response.usage) };
      receipt = { invocationId, usage: response.usage, completion: response.completion };
      if (
        !["complete", "truncated", "refused", "failed", "cancelled"].includes(response.completion)
      ) {
        receipt = { ...receipt, completion: "unknown" };
        failure("analysis-invalid-completion");
      }
    } catch (error) {
      const problem =
        error instanceof GrowthAnalysisProblem
          ? error
          : new GrowthAnalysisProblem("analysis-provider-failed", errorCause(error));
      const settleFailure = async (): Promise<AnalysisProposal> => {
        try {
          await this.options.settleUsage(receipt);
        } catch (sinkError) {
          throw new AnalysisSettlementProblem(
            new AggregateError([problem, sinkError]),
            settleFailure,
          );
        }
        throw problem;
      };
      return await settleFailure();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
    const finish = async (): Promise<AnalysisProposal> => {
      this.checkAbort(signal);
      if (response.completion === "failed" || response.completion === "cancelled")
        throw new GrowthAnalysisProblem(
          response.completion === "failed" ? "analysis-provider-failed" : "analysis-cancelled",
          response.cause,
        );
      if (
        response.usage.kind !== "unknown" &&
        response.usage.outputTokens > this.options.limits.maxOutputTokens
      )
        failure("analysis-output-budget-exceeded");
      if (response.completion !== "complete")
        return { status: "unavailable", reason: response.completion, usage: response.usage };
      if (
        typeof response.json !== "string" ||
        bytes(response.json) > this.options.limits.maxOutputBytes
      )
        failure("analysis-output-budget-exceeded");
      let parsed: unknown;
      try {
        parsed = JSON.parse(response.json);
      } catch (error) {
        throw new GrowthAnalysisProblem("analysis-invalid-json", errorCause(error));
      }
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        Object.keys(parsed).length !== 1 ||
        !("choiceIds" in parsed) ||
        !Array.isArray(parsed.choiceIds) ||
        parsed.choiceIds.length > choices.length ||
        parsed.choiceIds.some((id) => typeof id !== "string") ||
        new Set(parsed.choiceIds).size !== parsed.choiceIds.length
      )
        failure("analysis-invalid-plan");
      const choiceIds = parsed.choiceIds;
      const selected = choices.filter((choice) => choiceIds.includes(choice.id));
      if (selected.length !== choiceIds.length) failure("analysis-invalid-plan");
      // Recheck definitions/permissions after model execution, including receipt recovery.
      const current = await this.allowedChoices(signal);
      if (
        selected.some(
          (choice) => !current.some((item) => JSON.stringify(item) === JSON.stringify(choice)),
        )
      )
        return { status: "unavailable", reason: "definitions-changed", usage: response.usage };
      return selected.length
        ? { status: "confirmation", choices: selected, usage: response.usage }
        : { status: "unavailable", reason: "unsupported", usage: response.usage };
    };
    const settle = async (): Promise<AnalysisProposal> => {
      try {
        await this.options.settleUsage(receipt);
      } catch (error) {
        throw new AnalysisSettlementProblem(
          errorCause(error) ?? new Error("Usage settlement failed"),
          settle,
        );
      }
      return finish();
    };
    return settle();
  }

  async execute(plan: AnalysisPlan, signal?: AbortSignal): Promise<AnalysisOutcome> {
    this.checkAbort(signal);
    if (!plan || bytes(planKey(plan)) > this.options.limits.maxInputBytes)
      failure("analysis-invalid-plan");
    const service = this.options.readService;
    const choices = await this.allowedChoices(signal);
    const choice = choices.find((item) => planKey(item.plan) === planKey(plan));
    if (!choice) return { status: "definition-changed" };
    const registration = this.options.registrations().find((item) => item.id === choice.id);
    if (!registration) return { status: "definition-changed" };
    const outcome = await service.runRegisteredQuery(plan.queryId, plan.parameters, plan.window, {
      expectedVersion: plan.version,
      signal,
    });
    this.checkAbort(signal);
    if (outcome.status !== "verified") return { status: outcome.status };
    if (!sameDefinition(outcome.result.definition, choice.plan.metricDefinition))
      return { status: "definition-changed" };
    const facts = registration.facts(outcome.result);
    if (
      !Array.isArray(facts) ||
      facts.length === 0 ||
      facts.length > 32 ||
      facts.some(
        (fact) =>
          typeof fact.label !== "string" ||
          fact.label.length > 120 ||
          (fact.value !== null &&
            (typeof fact.value !== "string" ||
              !/^-?\d+(\.\d+)?$/.test(fact.value) ||
              fact.value.length > 128)),
      )
    )
      failure("analysis-invalid-facts");
    return {
      status: "ready",
      answer: {
        facts,
        sourceRefs: outcome.result.definition.sourceRefs,
        snapshotRefs: outcome.result.snapshotRefs,
        window: outcome.result.window,
        population: outcome.result.population,
        metricDefinition: outcome.result.definition,
        source: outcome.source,
        availability: facts.some((fact) => fact.value === null) ? "missing" : "ready",
        limitations: [
          ...outcome.result.diagnostics,
          "Observed facts do not establish a causal explanation.",
        ],
        numerator: outcome.result.numerator,
        denominator: outcome.result.denominator,
      },
    };
  }

  private async allowedChoices(signal?: AbortSignal): Promise<readonly AnalysisChoice[]> {
    this.checkAbort(signal);
    const definitions = await this.options.readService.listDefinitions();
    this.checkAbort(signal);
    const registrations = this.options.registrations();
    const contextRef = this.options.contextRef();
    if (
      registrations.length > 32 ||
      new Set(registrations.map((item) => item.id)).size !== registrations.length
    )
      failure("analysis-invalid-registration");
    return registrations.flatMap((item) => {
      const definition = definitions.find((definition) => definition.id === item.definitionId);
      if (!definition) return [];
      const plan: AnalysisPlan = {
        contextRef,
        queryId: item.queryId,
        version: item.version,
        parameters: item.parameters,
        window: item.window,
        metricDefinition: definition,
        assumptions: item.assumptions,
        coverage: "confirmation-required",
      };
      try {
        planKey(plan);
      } catch (error) {
        throw new GrowthAnalysisProblem("analysis-invalid-registration", errorCause(error));
      }
      return [{ id: item.id, label: item.label, plan }];
    });
  }

  private checkAbort(signal?: AbortSignal): void {
    if (signal?.aborted) failure("analysis-cancelled");
  }
}
