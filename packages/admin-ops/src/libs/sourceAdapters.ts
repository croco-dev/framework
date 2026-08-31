import type {
  Execution,
  ExecutionInspectionManager,
  ExecutionManager,
  ExecutionReplayManager,
  ReplayExecutionParams,
} from "@croco/execution-core";
import type { LifecycleRun, LifecycleRunStore } from "@croco/lifecycle-core";
import type {
  RetryConsoleCorrelationIds,
  RetryConsoleItem,
  RetryConsoleItemState,
  RetryConsoleListOptions,
  RetryConsolePermissionDescriptor,
  RetryConsoleRecoveryAction,
  RetryConsoleRecoveryInput,
  RetryConsoleSource,
  RetryConsoleSourceKind,
  RetryConsoleSourceRecoveryResult,
  RetryConsoleTimestamps,
} from "./types";

type ExecutionAdminManager = ExecutionManager &
  Pick<ExecutionInspectionManager, "list"> &
  Partial<Pick<ExecutionInspectionManager, "recordLog">> &
  Partial<ExecutionReplayManager>;

type ExecutionSourceOptions = {
  readonly kind: RetryConsoleSourceKind;
  readonly label: string;
  readonly filter?: (execution: Execution) => boolean;
};

type LifecycleRecoveryProvider = (
  run: LifecycleRun,
  request: RetryConsoleRecoveryInput,
) => Promise<RetryConsoleSourceRecoveryResult>;

type LifecycleSourceOptions = {
  readonly store: Pick<LifecycleRunStore, "list">;
  readonly recover?: LifecycleRecoveryProvider;
};

const CORRELATION_METADATA_KEYS = [
  "correlationId",
  "requestId",
  "traceId",
  "tenantId",
  "workflowExecutionId",
  "workflowName",
  "taskName",
  "batchName",
  "stepName",
];

const RECOVERY_ACTION_LABELS = {
  inspect: "Inspect",
  none: "None",
  replay: "Replay",
  retry: "Retry",
  wait: "Wait",
} satisfies Record<RetryConsoleRecoveryAction["kind"], string>;

function toIsoTimestamp(timestamp?: Date): string | undefined {
  return timestamp?.toISOString();
}

function metadataString(execution: Execution, key: string): string | undefined {
  const value = execution.metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readWorkflowName(execution: Execution): string | undefined {
  return metadataString(execution, "workflowName");
}

function readTaskName(execution: Execution): string {
  return metadataString(execution, "taskName") ?? execution.type;
}

function readBatchName(execution: Execution): string | undefined {
  return metadataString(execution, "batchName") ?? metadataString(execution, "jobName");
}

function hasAttemptsRemaining(execution: Execution): boolean {
  return execution.attempts < execution.maxAttempts;
}

function classifyExecution(execution: Execution): RetryConsoleItemState {
  switch (execution.status) {
    case "pending":
    case "running":
    case "retrying":
      return "running";
    case "completed":
      return "succeeded";
    case "timed_out":
      if (execution.error?.indeterminate === true) {
        return "non_retryable";
      }
      return hasAttemptsRemaining(execution) ? "retryable" : "terminal_failed";
    case "failed":
      if (execution.error?.retryable && hasAttemptsRemaining(execution)) {
        return "retryable";
      }

      return execution.error?.retryable ? "terminal_failed" : "non_retryable";
    case "cancelled":
      return "terminal_failed";
    default:
      return "terminal_failed";
  }
}

function problemFromExecution(execution: Execution) {
  if (!execution.error) {
    return undefined;
  }

  return {
    code: execution.error.code ?? "execution-core/execution-failed",
    message: execution.error.message,
    retryable: execution.error.retryable,
    stack: execution.error.stack,
  };
}

function timestampsFromExecution(execution: Execution): RetryConsoleTimestamps {
  return {
    createdAt: execution.createdAt.toISOString(),
    startedAt: toIsoTimestamp(execution.startedAt),
    completedAt: toIsoTimestamp(execution.completedAt),
  };
}

function correlationIdsFromExecution(execution: Execution): RetryConsoleCorrelationIds {
  const metadataIds = Object.fromEntries(
    CORRELATION_METADATA_KEYS.map((key) => [key, metadataString(execution, key)]).filter(
      ([, value]) => value !== undefined,
    ),
  );

  return {
    ...metadataIds,
    executionId: execution.id,
    parentExecutionId: execution.parentId,
    replayOf: execution.replayOf,
    workflowExecutionId: metadataString(execution, "workflowExecutionId"),
    workflowName: readWorkflowName(execution),
    taskName: readTaskName(execution),
    batchName: readBatchName(execution),
    idempotencyKey: execution.idempotencyKey,
  };
}

function permissionDescriptor(
  kind: RetryConsoleSourceKind,
  action: "retry" | "replay" | "inspect",
  itemId: string,
): RetryConsolePermissionDescriptor {
  return {
    action: `admin-ops:${action}`,
    resource: `${kind}:${itemId}`,
    scope: "admin-ops:recovery",
  };
}

function recoveryAction(
  kind: RetryConsoleSourceKind,
  itemId: string,
  actionKind: RetryConsoleRecoveryAction["kind"],
  allowed: boolean,
  reason: string,
): RetryConsoleRecoveryAction {
  const actionable = actionKind === "retry" || actionKind === "replay" || actionKind === "inspect";

  return {
    id: actionKind,
    kind: actionKind,
    label: RECOVERY_ACTION_LABELS[actionKind],
    allowed,
    reason,
    permission: permissionDescriptor(kind, actionable ? actionKind : "inspect", itemId),
    requiresAudit: actionable && actionKind !== "inspect",
    requiresIdempotencyKey: actionable && actionKind !== "inspect",
  };
}

function executionRecoveryActions(
  execution: Execution,
  kind: RetryConsoleSourceKind,
  manager: ExecutionAdminManager,
): readonly RetryConsoleRecoveryAction[] {
  const state = classifyExecution(execution);
  const canRecordAudit = typeof manager.recordLog === "function";
  const canReplay = typeof manager.replay === "function" && execution.status !== "cancelled";

  if (execution.status === "timed_out" && execution.error?.indeterminate === true) {
    return [
      recoveryAction(
        kind,
        execution.id,
        "inspect",
        true,
        "Inspect external effects, then resolve the timeout with an audited operator reason",
      ),
    ];
  }

  if (state === "retryable") {
    return [
      recoveryAction(
        kind,
        execution.id,
        "retry",
        canRecordAudit,
        canRecordAudit
          ? "Execution can be retried with an audit log entry"
          : "Execution manager does not support audit log append",
      ),
    ];
  }

  if (state === "terminal_failed") {
    return [
      recoveryAction(
        kind,
        execution.id,
        "replay",
        canReplay,
        canReplay
          ? "Execution can be replayed as a new pending execution"
          : "Execution manager does not support replay",
      ),
    ];
  }

  if (state === "non_retryable") {
    return [
      recoveryAction(
        kind,
        execution.id,
        "inspect",
        true,
        "Failure is non-retryable and must be inspected before a new action is created",
      ),
    ];
  }

  return [
    recoveryAction(
      kind,
      execution.id,
      state === "running" ? "wait" : "none",
      false,
      state === "running" ? "Execution is still in progress" : "Execution already succeeded",
    ),
  ];
}

export function retryConsoleItemFromExecution(
  execution: Execution,
  options: ExecutionSourceOptions,
  manager: ExecutionAdminManager,
): RetryConsoleItem {
  const title =
    options.kind === "workflow"
      ? (readWorkflowName(execution) ?? execution.type)
      : options.kind === "batch"
        ? (readBatchName(execution) ?? execution.type)
        : readTaskName(execution);

  const state = classifyExecution(execution);

  return {
    id: execution.id,
    source: {
      kind: options.kind,
      label: options.label,
      target: title,
    },
    state,
    title,
    retryable: state === "retryable",
    problem: problemFromExecution(execution),
    attempts: {
      current: execution.attempts,
      max: execution.maxAttempts,
    },
    timestamps: timestampsFromExecution(execution),
    correlationIds: correlationIdsFromExecution(execution),
    recoveryActions: executionRecoveryActions(execution, options.kind, manager),
    details: {
      payload: execution.payload,
      result: execution.result,
      metadata: execution.metadata,
      checkpoints: execution.checkpoints,
      progress: execution.progress,
      logCount: execution.logs?.length ?? 0,
    },
  };
}

function matchesOptions(item: RetryConsoleItem, options: RetryConsoleListOptions): boolean {
  if (options.states && !options.states.includes(item.state)) {
    return false;
  }

  if (options.sourceKinds && !options.sourceKinds.includes(item.source.kind)) {
    return false;
  }

  if (!options.includeSucceeded && item.state === "succeeded") {
    return false;
  }

  return true;
}

function auditLogData(
  request: RetryConsoleRecoveryInput,
  action: RetryConsoleRecoveryAction,
): Record<string, unknown> {
  return {
    actionId: action.id,
    actionKind: action.kind,
    actorId: request.audit.actorId,
    reason: request.audit.reason,
    idempotencyKey: request.audit.idempotencyKey,
    ticketId: request.audit.ticketId,
    metadata: request.audit.metadata,
  };
}

function replayParams(request: RetryConsoleRecoveryInput): ReplayExecutionParams {
  return {
    reason: request.audit.reason,
    payload: request.payload,
    metadata: {
      ...request.metadata,
      recoveryActorId: request.audit.actorId,
      recoveryAuditIdempotencyKey: request.audit.idempotencyKey,
      recoveryTicketId: request.audit.ticketId,
      recoveryMetadata: request.audit.metadata,
    },
  };
}

function isRecoveryReplay(
  execution: Execution,
  sourceExecutionId: string,
  idempotencyKey: string,
): boolean {
  return (
    execution.replayOf === sourceExecutionId &&
    metadataString(execution, "recoveryAuditIdempotencyKey") === idempotencyKey
  );
}

async function findExistingRecoveryReplay(
  manager: ExecutionAdminManager,
  item: RetryConsoleItem,
  request: RetryConsoleRecoveryInput,
): Promise<Execution | undefined> {
  const executions = await manager.list();
  return executions.find((execution) =>
    isRecoveryReplay(execution, item.id, request.audit.idempotencyKey),
  );
}

async function recoverExecution(
  manager: ExecutionAdminManager,
  item: RetryConsoleItem,
  request: RetryConsoleRecoveryInput,
  action: RetryConsoleRecoveryAction,
  options: ExecutionSourceOptions,
): Promise<RetryConsoleSourceRecoveryResult> {
  if (action.kind === "retry") {
    if (!manager.recordLog) {
      throw new Error("Execution manager does not support audit log append");
    }

    await manager.recordLog(item.id, {
      level: "info",
      message: "Admin recovery retry requested",
      data: auditLogData(request, action),
    });
    const retried = await manager.retry(item.id);
    return {
      item: retryConsoleItemFromExecution(retried, options, manager),
      providerResult: retried,
    };
  }

  if (action.kind === "replay") {
    const existingReplay = await findExistingRecoveryReplay(manager, item, request);
    if (existingReplay) {
      return {
        item: retryConsoleItemFromExecution(existingReplay, options, manager),
        providerResult: existingReplay,
      };
    }

    if (!manager.replay) {
      throw new Error("Execution manager does not support replay");
    }

    const replayed = await manager.replay(item.id, replayParams(request));
    return {
      item: retryConsoleItemFromExecution(replayed, options, manager),
      providerResult: replayed,
    };
  }

  return { item };
}

export function createExecutionRetryConsoleSource(
  manager: ExecutionAdminManager,
  options: ExecutionSourceOptions,
): RetryConsoleSource {
  return {
    kind: options.kind,

    async list(listOptions: RetryConsoleListOptions = {}): Promise<readonly RetryConsoleItem[]> {
      const executions = await manager.list();
      return executions
        .filter((execution) => options.filter?.(execution) ?? true)
        .map((execution) => retryConsoleItemFromExecution(execution, options, manager))
        .filter((item) => matchesOptions(item, listOptions));
    },

    async recover(
      item: RetryConsoleItem,
      request: RetryConsoleRecoveryInput,
      action: RetryConsoleRecoveryAction,
    ): Promise<RetryConsoleSourceRecoveryResult> {
      return recoverExecution(manager, item, request, action, options);
    },
  };
}

function isWorkflowExecution(execution: Execution): boolean {
  return execution.type === "workflow" || readWorkflowName(execution) !== undefined;
}

function isBatchExecution(execution: Execution): boolean {
  return execution.type === "batch" || readBatchName(execution) !== undefined;
}

function isTaskExecution(execution: Execution): boolean {
  return !isWorkflowExecution(execution) && !isBatchExecution(execution);
}

export function createTaskRetryConsoleSource(manager: ExecutionAdminManager): RetryConsoleSource {
  return createExecutionRetryConsoleSource(manager, {
    kind: "task",
    label: "Task",
    filter: isTaskExecution,
  });
}

export function createWorkflowRetryConsoleSource(
  manager: ExecutionAdminManager,
): RetryConsoleSource {
  return createExecutionRetryConsoleSource(manager, {
    kind: "workflow",
    label: "Workflow",
    filter: isWorkflowExecution,
  });
}

export function createBatchRetryConsoleSource(manager: ExecutionAdminManager): RetryConsoleSource {
  return createExecutionRetryConsoleSource(manager, {
    kind: "batch",
    label: "Batch",
    filter: isBatchExecution,
  });
}

function lifecycleProblem(run: LifecycleRun) {
  if (run.status === "indeterminate") {
    return {
      code: "lifecycle-core/run-indeterminate",
      message: "Lifecycle action dispatch may have completed and requires reconciliation",
      retryable: false,
    };
  }

  const failedAction = run.actionResults.find((actionResult) => actionResult.status === "failure");
  const error = run.error ?? failedAction?.error;

  if (!error) {
    return undefined;
  }

  return {
    code: error.code ?? "lifecycle-core/run-failed",
    message: error.message,
    retryable: false,
  };
}

function lifecycleState(run: LifecycleRun): RetryConsoleItemState {
  if (run.status === "indeterminate") {
    return "reconciliation_required";
  }
  if (run.status === "succeeded") {
    return "succeeded";
  }

  return run.status === "failed" ? "terminal_failed" : "non_retryable";
}

function lifecycleRecoveryActions(
  run: LifecycleRun,
  recover: LifecycleRecoveryProvider | undefined,
): readonly RetryConsoleRecoveryAction[] {
  const state = lifecycleState(run);

  if (state === "reconciliation_required") {
    return [
      recoveryAction(
        "lifecycle",
        run.id,
        "inspect",
        true,
        "Reconcile the external provider outcome before finalizing this run; do not replay it",
      ),
    ];
  }

  if (state === "terminal_failed") {
    return [
      recoveryAction(
        "lifecycle",
        run.id,
        "replay",
        recover !== undefined,
        recover
          ? "Lifecycle run can be recreated through the configured recovery provider"
          : "Lifecycle recovery provider is not configured",
      ),
    ];
  }

  if (state === "non_retryable") {
    return [
      recoveryAction(
        "lifecycle",
        run.id,
        "inspect",
        true,
        "Lifecycle run was skipped or cannot be retried from the console",
      ),
    ];
  }

  return [recoveryAction("lifecycle", run.id, "none", false, "Lifecycle run already succeeded")];
}

export function retryConsoleItemFromLifecycleRun(
  run: LifecycleRun,
  recover?: LifecycleRecoveryProvider,
): RetryConsoleItem {
  const state = lifecycleState(run);

  return {
    id: run.id,
    source: {
      kind: "lifecycle",
      label: "Lifecycle",
      target: run.ruleId,
    },
    state,
    title: run.ruleId,
    retryable: false,
    problem: lifecycleProblem(run),
    attempts: {
      current: 1,
      max: 1,
    },
    timestamps: {
      createdAt: run.startedAt.toISOString(),
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt.toISOString(),
    },
    correlationIds: {
      lifecycleRunId: run.id,
      lifecycleRuleId: run.ruleId,
      tenantId: run.tenantId,
      signalId: run.signalId,
      idempotencyKey: run.idempotencyKey,
    },
    recoveryActions: lifecycleRecoveryActions(run, recover),
    details: {
      severity: run.severity,
      signalType: run.signalType,
      skipReason: run.skipReason,
      actionResults: run.actionResults,
    },
  };
}

export function createLifecycleRetryConsoleSource(
  options: LifecycleSourceOptions,
): RetryConsoleSource {
  return {
    kind: "lifecycle",

    async list(listOptions: RetryConsoleListOptions = {}): Promise<readonly RetryConsoleItem[]> {
      const runs = await options.store.list();
      return runs
        .map((run) => retryConsoleItemFromLifecycleRun(run, options.recover))
        .filter((item) => matchesOptions(item, listOptions));
    },

    async recover(
      item: RetryConsoleItem,
      request: RetryConsoleRecoveryInput,
    ): Promise<RetryConsoleSourceRecoveryResult> {
      if (!options.recover) {
        throw new Error("Lifecycle recovery provider is not configured");
      }

      const runs = await options.store.list();
      const run = runs.find((candidate) => candidate.id === item.id);
      if (!run) {
        throw new Error(`Lifecycle run '${item.id}' was not found`);
      }

      return options.recover(run, request);
    },
  };
}
