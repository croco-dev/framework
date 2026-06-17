import { LifecycleActionAdapterProblem } from "./problems/LifecycleProblems";
import type { LifecycleRuleRegistry } from "./LifecycleRuleRegistry";
import type {
  LifecycleAction,
  LifecycleActionAdapter,
  LifecycleActionResult,
  LifecycleContext,
  LifecycleEvaluationResult,
  LifecycleRule,
  LifecycleRun,
  LifecycleRunStore,
  LifecycleSkipReason,
} from "./types";

export type LifecycleRuleEvaluatorOptions = {
  readonly registry: LifecycleRuleRegistry;
  readonly runStore: LifecycleRunStore;
  readonly actionAdapter: LifecycleActionAdapter;
};

let runSequence = 0;

function createRunId(): string {
  runSequence += 1;
  return `lifecycle_run_${runSequence}`;
}

function defaultIdempotencyKey(rule: LifecycleRule, context: LifecycleContext): string {
  const signalKey = context.signal.id ?? context.signal.occurredAt.toISOString();
  return [rule.id, context.tenantId, context.signal.type, signalKey].join(":");
}

function summarizeAdapterError(action: LifecycleAction, error: unknown): LifecycleActionResult {
  return {
    actionId: action.id,
    type: action.type,
    status: "failure",
    error: {
      code: "lifecycle-core/action-adapter-threw",
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

function deriveRunStatus(actionResults: readonly LifecycleActionResult[]): LifecycleRun["status"] {
  if (actionResults.some((result) => result.status === "failure")) {
    return "failed";
  }

  if (actionResults.some((result) => result.status === "success")) {
    return "succeeded";
  }

  return "skipped";
}

function createSkippedRun(input: {
  readonly rule: LifecycleRule;
  readonly context: LifecycleContext;
  readonly idempotencyKey: string;
  readonly reason: LifecycleSkipReason;
}): LifecycleRun {
  const completedAt = new Date(input.context.now);

  return {
    id: createRunId(),
    ruleId: input.rule.id,
    tenantId: input.context.tenantId,
    signalType: input.context.signal.type,
    signalId: input.context.signal.id,
    severity: input.rule.severity,
    status: "skipped",
    idempotencyKey: input.idempotencyKey,
    skipReason: input.reason,
    actionResults: [],
    startedAt: completedAt,
    completedAt,
  };
}

export class LifecycleRuleEvaluator {
  private readonly registry: LifecycleRuleRegistry;
  private readonly runStore: LifecycleRunStore;
  private readonly actionAdapter: LifecycleActionAdapter;

  constructor(options: LifecycleRuleEvaluatorOptions) {
    this.registry = options.registry;
    this.runStore = options.runStore;
    this.actionAdapter = options.actionAdapter;
  }

  async evaluate(context: LifecycleContext): Promise<LifecycleEvaluationResult> {
    const runs: LifecycleRun[] = [];

    for (const rule of this.registry.match(context.signal)) {
      const run = await this.evaluateRule(rule, context);
      await this.runStore.save(run);
      runs.push(run);
    }

    return {
      tenantId: context.tenantId,
      signal: context.signal,
      evaluatedAt: context.now,
      runs,
    };
  }

  private async evaluateRule(
    rule: LifecycleRule,
    context: LifecycleContext,
  ): Promise<LifecycleRun> {
    const idempotencyKey =
      rule.idempotencyKey?.({ rule, context }) ?? defaultIdempotencyKey(rule, context);
    const existingRun = await this.runStore.findByIdempotencyKey(idempotencyKey);

    if (existingRun !== null) {
      return createSkippedRun({
        rule,
        context,
        idempotencyKey,
        reason: "idempotency_key_reused",
      });
    }

    if (rule.cooldown) {
      const since = new Date(context.now.getTime() - rule.cooldown.durationMs);
      const latestRun = await this.runStore.findLatestForRule(context.tenantId, rule.id, since);

      if (latestRun !== null) {
        return createSkippedRun({
          rule,
          context,
          idempotencyKey,
          reason: "cooldown_active",
        });
      }
    }

    if (rule.when && !(await rule.when(context))) {
      return createSkippedRun({
        rule,
        context,
        idempotencyKey,
        reason: "condition_not_met",
      });
    }

    const actions = typeof rule.actions === "function" ? await rule.actions(context) : rule.actions;

    if (actions.length === 0) {
      return createSkippedRun({
        rule,
        context,
        idempotencyKey,
        reason: "no_actions",
      });
    }

    const startedAt = new Date(context.now);
    const runBase = {
      id: createRunId(),
      ruleId: rule.id,
      tenantId: context.tenantId,
      idempotencyKey,
    };

    const actionResults = await Promise.all(
      actions.map(async (action) => {
        try {
          return await this.actionAdapter.execute(action, context, runBase);
        } catch (error) {
          return summarizeAdapterError(
            action,
            new LifecycleActionAdapterProblem(
              error instanceof Error ? error.message : String(error),
            ),
          );
        }
      }),
    );
    const status = deriveRunStatus(actionResults);
    const firstFailure = actionResults.find((result) => result.status === "failure");

    return {
      ...runBase,
      signalType: context.signal.type,
      signalId: context.signal.id,
      severity: rule.severity,
      status,
      skipReason: status === "skipped" ? "no_actions" : undefined,
      actionResults,
      error: firstFailure?.error,
      startedAt,
      completedAt: new Date(context.now),
    };
  }
}
