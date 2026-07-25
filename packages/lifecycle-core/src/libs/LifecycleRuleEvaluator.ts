import {
  LifecycleActionAdapterProblem,
  LifecycleRuleActionContractProblem,
  UnknownLifecycleRuleVersionProblem,
} from "./problems/LifecycleProblems";
import { InMemoryLifecycleDryRunStore } from "./InMemoryLifecycleDryRunStore";
import type { LifecycleRuleRegistry } from "./LifecycleRuleRegistry";
import type {
  LifecycleAction,
  LifecycleActionAdapter,
  LifecycleActionResult,
  LifecycleConditionEvidence,
  LifecycleContext,
  LifecycleDryRunProblem,
  LifecycleDryRunResult,
  LifecycleDryRunStore,
  LifecycleEvaluationResult,
  LifecycleRuleActionDescriptor,
  LifecycleRuleRegistration,
  LifecycleRun,
  LifecycleRunStore,
  LifecycleSkipReason,
} from "./types";

export type LifecycleRuleEvaluatorOptions = {
  readonly registry: LifecycleRuleRegistry;
  readonly runStore: LifecycleRunStore;
  readonly actionAdapter: LifecycleActionAdapter;
  readonly dryRunStore?: LifecycleDryRunStore;
};

export type LifecycleDryRunInput = {
  readonly ruleId: string;
  readonly version?: string;
  readonly context: LifecycleContext;
};

let runSequence = 0;

function createRunId(): string {
  runSequence += 1;
  return `lifecycle_run_${runSequence}`;
}

function defaultIdempotencyKey(
  registration: LifecycleRuleRegistration,
  context: LifecycleContext,
): string {
  const signalKey = context.signal.id ?? context.signal.occurredAt.toISOString();
  return [
    registration.rule.id,
    registration.descriptor.version,
    context.tenantId,
    context.signal.type,
    signalKey,
  ].join(":");
}

function resolveIdempotencyKey(
  registration: LifecycleRuleRegistration,
  context: LifecycleContext,
): string {
  const custom = registration.rule.idempotencyKey?.({ rule: registration.rule, context });
  return custom === undefined
    ? defaultIdempotencyKey(registration, context)
    : [registration.rule.id, registration.descriptor.version, custom].join(":");
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
  readonly registration: LifecycleRuleRegistration;
  readonly context: LifecycleContext;
  readonly idempotencyKey: string;
  readonly reason: LifecycleSkipReason;
}): LifecycleRun {
  const completedAt = new Date(input.context.now);

  return {
    id: createRunId(),
    ruleId: input.registration.rule.id,
    ruleVersion: input.registration.descriptor.version,
    ruleFingerprint: input.registration.descriptor.fingerprint,
    tenantId: input.context.tenantId,
    signalType: input.context.signal.type,
    signalId: input.context.signal.id,
    severity: input.registration.rule.severity,
    status: "skipped",
    idempotencyKey: input.idempotencyKey,
    skipReason: input.reason,
    actionResults: [],
    startedAt: completedAt,
    completedAt,
  };
}

function toSafeProposedAction(
  action: LifecycleAction,
  registration: LifecycleRuleRegistration,
): LifecycleRuleActionDescriptor {
  return (
    registration.descriptor.actions.find(
      (descriptor) => descriptor.id === action.id && descriptor.type === action.type,
    ) ?? { id: action.id, type: action.type }
  );
}

function isActionDeclared(
  action: LifecycleAction,
  registration: LifecycleRuleRegistration,
): boolean {
  return (
    registration.descriptor.executableRegistrationId.startsWith("legacy:") ||
    registration.descriptor.actions.some(
      (descriptor) => descriptor.id === action.id && descriptor.type === action.type,
    )
  );
}

function dryRunProblem(code: string): LifecycleDryRunProblem {
  return {
    code,
    message: "Lifecycle rule dry-run evaluation failed without exposing context values",
  };
}

function toDryRunSignalEvidence(context: LifecycleContext) {
  return {
    id: context.signal.id,
    type: context.signal.type,
    occurredAt: context.signal.occurredAt,
  };
}

function safeConditionEvidence(evidence: LifecycleConditionEvidence): LifecycleConditionEvidence {
  return Object.fromEntries(
    Object.entries(evidence).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

export class LifecycleRuleEvaluator {
  private readonly registry: LifecycleRuleRegistry;
  private readonly runStore: LifecycleRunStore;
  private readonly actionAdapter: LifecycleActionAdapter;
  private readonly dryRunStore: LifecycleDryRunStore;

  constructor(options: LifecycleRuleEvaluatorOptions) {
    this.registry = options.registry;
    this.runStore = options.runStore;
    this.actionAdapter = options.actionAdapter;
    this.dryRunStore = options.dryRunStore ?? new InMemoryLifecycleDryRunStore();
  }

  async evaluate(context: LifecycleContext): Promise<LifecycleEvaluationResult> {
    const runs: LifecycleRun[] = [];

    for (const registration of await this.registry.matchRegistrations(context.signal)) {
      const run = await this.evaluateRule(registration, context);
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

  async dryRun(input: LifecycleDryRunInput): Promise<LifecycleDryRunResult> {
    const identity = await this.registry.getIdentityState(input.ruleId);
    const record = input.version
      ? identity?.versions.find((version) => version.descriptor.version === input.version)
      : identity?.versions.find(
          (version) => version.state === "active" || version.state === "paused",
        );
    if (!record) {
      throw new UnknownLifecycleRuleVersionProblem(input.ruleId, input.version ?? "active");
    }

    const registration = this.registry.getRegistration(input.ruleId, record.descriptor.version);
    if (!registration) {
      const unavailableResult: LifecycleDryRunResult = {
        tenantId: input.context.tenantId,
        signal: toDryRunSignalEvidence(input.context),
        evaluatedAt: input.context.now,
        ruleId: input.ruleId,
        ruleVersion: record.descriptor.version,
        ruleFingerprint: record.descriptor.fingerprint,
        state: "unavailable",
        matched: false,
        conditionEvidence: {},
        proposedActions: [],
        suppression: { suppressed: true, reason: "rule_unavailable" },
        problems: [dryRunProblem("lifecycle-core/rule-version-unavailable")],
      };
      await this.dryRunStore.save(unavailableResult);
      return unavailableResult;
    }

    const problems: LifecycleDryRunProblem[] = [];
    let conditionEvidence: LifecycleConditionEvidence = {};
    let conditionMatched = true;

    try {
      conditionMatched = registration.rule.when
        ? await registration.rule.when(input.context)
        : true;
      conditionEvidence = registration.rule.conditionEvidence
        ? safeConditionEvidence(await registration.rule.conditionEvidence(input.context))
        : {};
    } catch {
      conditionMatched = false;
      problems.push(dryRunProblem("lifecycle-core/dry-run-condition-failed"));
    }

    const signalMatched = registration.rule.triggers.some(
      (trigger) => trigger.type === "*" || trigger.type === input.context.signal.type,
    );
    const matched = signalMatched && conditionMatched && problems.length === 0;
    let idempotencyKey: string | undefined;
    try {
      idempotencyKey = resolveIdempotencyKey(registration, input.context);
    } catch {
      problems.push(dryRunProblem("lifecycle-core/dry-run-idempotency-key-failed"));
    }
    const suppression =
      idempotencyKey === undefined
        ? { suppressed: true }
        : await this.resolveSuppression(registration, record.state, input.context, idempotencyKey);
    let proposedActions: readonly LifecycleRuleActionDescriptor[] = [];

    if (matched) {
      try {
        const actions =
          typeof registration.rule.actions === "function"
            ? await registration.rule.actions(input.context)
            : registration.rule.actions;
        const undeclaredActions = actions.filter(
          (action) => !isActionDeclared(action, registration),
        );
        if (undeclaredActions.length > 0) {
          problems.push(dryRunProblem("lifecycle-core/rule-action-contract-mismatch"));
        }
        proposedActions = actions
          .filter((action) => isActionDeclared(action, registration))
          .map((action) => toSafeProposedAction(action, registration));
      } catch {
        problems.push(dryRunProblem("lifecycle-core/dry-run-actions-failed"));
      }
    }

    const result: LifecycleDryRunResult = {
      tenantId: input.context.tenantId,
      signal: toDryRunSignalEvidence(input.context),
      evaluatedAt: input.context.now,
      ruleId: input.ruleId,
      ruleVersion: record.descriptor.version,
      ruleFingerprint: record.descriptor.fingerprint,
      state: record.state,
      matched,
      conditionEvidence,
      proposedActions,
      suppression,
      problems,
    };
    await this.dryRunStore.save(result);
    return result;
  }

  private async evaluateRule(
    registration: LifecycleRuleRegistration & { readonly state: "active" | "paused" },
    context: LifecycleContext,
  ): Promise<LifecycleRun> {
    const idempotencyKey = resolveIdempotencyKey(registration, context);

    if (registration.state === "paused") {
      return createSkippedRun({
        registration,
        context,
        idempotencyKey,
        reason: "rule_paused",
      });
    }

    const suppression = await this.resolveSuppression(
      registration,
      registration.state,
      context,
      idempotencyKey,
    );
    if (suppression.reason) {
      return createSkippedRun({
        registration,
        context,
        idempotencyKey,
        reason: suppression.reason,
      });
    }

    if (registration.rule.when && !(await registration.rule.when(context))) {
      return createSkippedRun({
        registration,
        context,
        idempotencyKey,
        reason: "condition_not_met",
      });
    }

    const actions =
      typeof registration.rule.actions === "function"
        ? await registration.rule.actions(context)
        : registration.rule.actions;

    const undeclaredActions = actions.filter((action) => !isActionDeclared(action, registration));
    if (undeclaredActions.length > 0) {
      const problem = new LifecycleRuleActionContractProblem(
        registration.rule.id,
        registration.descriptor.version,
      );
      const problemMessage = problem.detail ?? problem.message;
      const completedAt = new Date(context.now);
      return {
        id: createRunId(),
        ruleId: registration.rule.id,
        ruleVersion: registration.descriptor.version,
        ruleFingerprint: registration.descriptor.fingerprint,
        tenantId: context.tenantId,
        signalType: context.signal.type,
        signalId: context.signal.id,
        severity: registration.rule.severity,
        status: "failed",
        idempotencyKey,
        actionResults: undeclaredActions.map((action) => ({
          actionId: action.id,
          type: action.type,
          status: "failure",
          error: {
            code: problem.code,
            message: problemMessage,
          },
        })),
        error: {
          code: problem.code,
          message: problemMessage,
        },
        startedAt: completedAt,
        completedAt,
      };
    }

    const currentState = await this.registry.getRegistrationState(
      registration.rule.id,
      registration.descriptor.version,
    );
    if (currentState !== "active") {
      return createSkippedRun({
        registration,
        context,
        idempotencyKey,
        reason: currentState === "paused" ? "rule_paused" : "rule_not_active",
      });
    }

    if (actions.length === 0) {
      return createSkippedRun({
        registration,
        context,
        idempotencyKey,
        reason: "no_actions",
      });
    }

    const startedAt = new Date(context.now);
    const runBase = {
      id: createRunId(),
      ruleId: registration.rule.id,
      ruleVersion: registration.descriptor.version,
      ruleFingerprint: registration.descriptor.fingerprint,
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
      severity: registration.rule.severity,
      status,
      skipReason: status === "skipped" ? "no_actions" : undefined,
      actionResults,
      error: firstFailure?.error,
      startedAt,
      completedAt: new Date(context.now),
    };
  }

  private async resolveSuppression(
    registration: LifecycleRuleRegistration,
    state: "registered" | "inactive" | "active" | "paused" | "superseded",
    context: LifecycleContext,
    idempotencyKey: string,
  ): Promise<{ readonly suppressed: boolean; readonly reason?: LifecycleSkipReason }> {
    if (state === "paused") {
      return { suppressed: true, reason: "rule_paused" };
    }
    if (state !== "active") {
      return { suppressed: true, reason: "rule_not_active" };
    }

    const existingRun = await this.runStore.findByIdempotencyKey(idempotencyKey);
    if (existingRun !== null) {
      return { suppressed: true, reason: "idempotency_key_reused" };
    }

    if (registration.rule.cooldown) {
      const since = new Date(context.now.getTime() - registration.rule.cooldown.durationMs);
      const latestRun = await this.runStore.findLatestForRule(
        context.tenantId,
        registration.rule.id,
        since,
      );
      if (latestRun !== null) {
        return { suppressed: true, reason: "cooldown_active" };
      }
    }

    return { suppressed: false };
  }
}
