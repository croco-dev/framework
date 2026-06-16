import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import type {
  Execution,
  ExecutionInspectionManager,
  ExecutionLogEntry,
  ExecutionLogLevel,
  ExecutionManager,
  ExecutionStatus,
} from "@croco/execution-core";
import { WorkflowRegistry } from "../WorkflowRegistry";

const DEFAULT_EXECUTION_LIMIT = 20;
const DEFAULT_EXECUTION_PAGE_SIZE = 100;
const WORKFLOW_EXECUTION_TYPE = "workflow";
const EXECUTION_STATUSES: readonly ExecutionStatus[] = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "retrying",
  "timed_out",
];

type InspectableExecutionManager = ExecutionManager & Pick<ExecutionInspectionManager, "list">;

export type WorkflowDiagnosticsProviderOptions = {
  readonly executionLimit?: number;
  readonly executionPageSize?: number;
};

export type WorkflowDiagnosticsWorkflowDetails = {
  readonly name: string;
  readonly description?: string;
  readonly stepCount: number;
  readonly triggerTypes: readonly string[];
};

export type WorkflowDiagnosticsExecutionDetails = {
  readonly id: string;
  readonly workflowName?: string;
  readonly status: ExecutionStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly replayOf?: string;
  readonly errorMessage?: string;
  readonly logCount: number;
  readonly latestLog?: WorkflowDiagnosticsLogDetails;
};

export type WorkflowDiagnosticsLogDetails = {
  readonly timestamp: string;
  readonly level: ExecutionLogLevel;
  readonly message: string;
};

export type WorkflowDiagnosticsDetails = {
  readonly inspectionSupported: boolean;
  readonly registeredWorkflowCount: number;
  readonly workflows: readonly WorkflowDiagnosticsWorkflowDetails[];
  readonly executionCount?: number;
  readonly executionsByStatus?: Record<ExecutionStatus, number>;
  readonly attentionExecutionCount?: number;
  readonly latestExecutions?: readonly WorkflowDiagnosticsExecutionDetails[];
};

function supportsExecutionInspection(
  manager: ExecutionManager,
): manager is InspectableExecutionManager {
  return typeof (manager as { list?: unknown }).list === "function";
}

function toIsoTimestamp(timestamp: Date | undefined): string | undefined {
  return timestamp?.toISOString();
}

function createStatusCounts(executions: readonly Execution[]): Record<ExecutionStatus, number> {
  return Object.fromEntries(
    EXECUTION_STATUSES.map((status) => [
      status,
      executions.filter((execution) => execution.status === status).length,
    ]),
  ) as Record<ExecutionStatus, number>;
}

function getAttentionExecutionCount(statusCounts: Record<ExecutionStatus, number>): number {
  return statusCounts.failed + statusCounts.retrying + statusCounts.timed_out;
}

function getWorkflowName(execution: Execution): string | undefined {
  const workflowName = execution.metadata?.workflowName;
  return typeof workflowName === "string" ? workflowName : undefined;
}

function summarizeLog(entry: ExecutionLogEntry): WorkflowDiagnosticsLogDetails {
  return {
    timestamp: entry.timestamp,
    level: entry.level,
    message: entry.message,
  };
}

function summarizeExecution(execution: Execution): WorkflowDiagnosticsExecutionDetails {
  const latestLog = execution.logs?.at(-1);

  return {
    id: execution.id,
    workflowName: getWorkflowName(execution),
    status: execution.status,
    attempts: execution.attempts,
    maxAttempts: execution.maxAttempts,
    createdAt: execution.createdAt.toISOString(),
    startedAt: toIsoTimestamp(execution.startedAt),
    completedAt: toIsoTimestamp(execution.completedAt),
    replayOf: execution.replayOf,
    errorMessage: execution.error?.message,
    logCount: execution.logs?.length ?? 0,
    latestLog: latestLog ? summarizeLog(latestLog) : undefined,
  };
}

function sortExecutionsByCreatedAt(
  executions: readonly Execution[],
  limit: number,
): readonly Execution[] {
  return [...executions]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit);
}

async function listAllWorkflowExecutions(
  manager: InspectableExecutionManager,
  pageSize: number,
  signal?: AbortSignal,
): Promise<Execution[]> {
  const executions: Execution[] = [];
  let offset = 0;

  for (;;) {
    if (signal?.aborted) {
      return executions;
    }

    const page = await manager.list({
      type: WORKFLOW_EXECUTION_TYPE,
      limit: pageSize,
      offset,
    });

    executions.push(...page);

    if (signal?.aborted || page.length < pageSize) {
      return executions;
    }

    offset += pageSize;
  }
}

export class WorkflowDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "workflow";

  constructor(
    private readonly executionManager: ExecutionManager,
    private readonly registry: WorkflowRegistry = WorkflowRegistry.fromMetadata(),
    private readonly options: WorkflowDiagnosticsProviderOptions = {},
  ) {}

  async getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    const workflows = this.registry.getAll().map((workflow) => ({
      name: workflow.name,
      description: workflow.description,
      stepCount: workflow.steps.length,
      triggerTypes: workflow.triggers.map((trigger) => trigger.type),
    }));

    if (!supportsExecutionInspection(this.executionManager)) {
      return {
        status: "degraded",
        component: "workflow",
        message: "Workflow execution inspection is not available",
        details: {
          inspectionSupported: false,
          registeredWorkflowCount: workflows.length,
          workflows,
        } satisfies WorkflowDiagnosticsDetails,
        lastChecked: new Date().toISOString(),
      };
    }

    const executionLimit = this.options.executionLimit ?? DEFAULT_EXECUTION_LIMIT;
    const executionPageSize = Math.max(
      1,
      this.options.executionPageSize ?? DEFAULT_EXECUTION_PAGE_SIZE,
    );
    const executions = await listAllWorkflowExecutions(
      this.executionManager,
      executionPageSize,
      signal,
    );
    const statusCounts = createStatusCounts(executions);
    const attentionExecutionCount = getAttentionExecutionCount(statusCounts);
    const status = attentionExecutionCount > 0 ? "degraded" : "healthy";

    return {
      status,
      component: "workflow",
      ...(attentionExecutionCount > 0
        ? { message: `${attentionExecutionCount} workflow execution(s) need attention` }
        : {}),
      details: {
        inspectionSupported: true,
        registeredWorkflowCount: workflows.length,
        workflows,
        executionCount: executions.length,
        executionsByStatus: statusCounts,
        attentionExecutionCount,
        latestExecutions: sortExecutionsByCreatedAt(executions, executionLimit).map(
          summarizeExecution,
        ),
      } satisfies WorkflowDiagnosticsDetails,
      lastChecked: new Date().toISOString(),
    };
  }
}
