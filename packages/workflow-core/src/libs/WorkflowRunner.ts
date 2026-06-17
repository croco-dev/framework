import type {
  Execution,
  ExecutionInspectionManager,
  ExecutionManager,
  ExecutionReplayManager,
  ReplayExecutionParams,
} from "@croco/execution-core";
import { TaskRunner } from "@croco/tasks-core";
import { withSpan } from "@croco/telemetry-api";
import {
  WorkflowNotFoundProblem,
  WorkflowReplayUnsupportedProblem,
} from "./problems/WorkflowProblems";
import { WorkflowRegistry } from "./WorkflowRegistry";
import type {
  WorkflowDefinition,
  WorkflowRunResult,
  WorkflowStepContext,
  WorkflowStepResult,
} from "./types";

type LoggableExecutionManager = ExecutionManager & Pick<ExecutionInspectionManager, "recordLog">;

type ReplayableExecutionManager = ExecutionManager & ExecutionReplayManager;

type TelemetryAttributeValue = string | number | boolean;

type WorkflowTelemetrySpan = {
  setAttribute(name: string, value: TelemetryAttributeValue): void;
  addEvent(name: string, attributes?: Record<string, TelemetryAttributeValue>): void;
};

function supportsRecordLog(manager: ExecutionManager): manager is LoggableExecutionManager {
  return typeof (manager as { recordLog?: unknown }).recordLog === "function";
}

function supportsReplay(manager: ExecutionManager): manager is ReplayableExecutionManager {
  return typeof (manager as { replay?: unknown }).replay === "function";
}

function createInvocationId(workflowName: string): string {
  return `${workflowName}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function toExecutionError(error: unknown) {
  return {
    message: error instanceof Error ? error.message : String(error),
    retryable: error instanceof Error && "retryable" in error ? Boolean(error.retryable) : false,
    code: error instanceof Error && "code" in error ? String(error.code) : undefined,
    stack: error instanceof Error ? error.stack : undefined,
  };
}

function setWorkflowTelemetryAttributes(
  span: WorkflowTelemetrySpan,
  workflow: WorkflowDefinition,
): void {
  span.setAttribute("workflow.name", workflow.name);
  span.setAttribute("workflow.method", workflow.methodName);
  span.setAttribute("workflow.step.count", workflow.steps.length);
  span.setAttribute("workflow.trigger.count", workflow.triggers.length);

  const triggerTypes = workflow.triggers.map((trigger) => trigger.type).join(",");
  if (triggerTypes.length > 0) {
    span.setAttribute("workflow.trigger.types", triggerTypes);
  }
}

function getExecutionTelemetryAttributes(
  workflow: WorkflowDefinition,
  execution: Execution,
): Record<string, TelemetryAttributeValue> {
  return {
    "workflow.name": workflow.name,
    "workflow.execution.id": execution.id,
    "workflow.execution.status": execution.status,
    "workflow.execution.attempts": execution.attempts,
    "workflow.execution.max_attempts": execution.maxAttempts,
  };
}

export class WorkflowRunner {
  constructor(
    private readonly executionManager: ExecutionManager,
    private readonly registry: WorkflowRegistry = WorkflowRegistry.fromMetadata(),
    private readonly taskRunner: TaskRunner = new TaskRunner(
      executionManager,
      registry.taskRegistry,
    ),
  ) {}

  async execute(workflowName: string, payload: unknown): Promise<WorkflowRunResult> {
    return withSpan(async (span) => this.executeWithTelemetry(workflowName, payload, span), {
      name: `workflow:${workflowName}`,
      attributes: {
        "workflow.name": workflowName,
      },
    });
  }

  private async executeWithTelemetry(
    workflowName: string,
    payload: unknown,
    span: WorkflowTelemetrySpan,
  ): Promise<WorkflowRunResult> {
    const workflow = this.getWorkflow(workflowName);
    setWorkflowTelemetryAttributes(span, workflow);

    const idempotencyKey = this.resolveIdempotencyKey(workflow, payload);
    const invocationId = idempotencyKey ? createInvocationId(workflow.name) : undefined;
    const execution = await this.executionManager.create({
      type: "workflow",
      payload,
      maxAttempts: workflow.options.maxAttempts,
      timeout: workflow.options.timeout,
      idempotencyKey,
      metadata: {
        workflowName: workflow.name,
        workflowMethod: workflow.methodName,
        workflowSteps: workflow.steps.map((step) => step.name),
        workflowTriggers: workflow.triggers.map((trigger) => trigger.type),
        ...(invocationId !== undefined ? { workflowInvocationId: invocationId } : {}),
      },
    });
    const executionAttributes = getExecutionTelemetryAttributes(workflow, execution);
    const canResumeRetryingExecution =
      execution.status === "retrying" && execution.metadata?.workflowName === workflow.name;
    span.setAttribute("workflow.execution.id", execution.id);
    span.setAttribute("workflow.idempotent", idempotencyKey !== undefined);

    if (
      idempotencyKey !== undefined &&
      execution.metadata?.workflowInvocationId !== invocationId &&
      !canResumeRetryingExecution
    ) {
      span.setAttribute("workflow.reused", true);
      span.addEvent("workflow.execution.reused", executionAttributes);
      return {
        executionId: execution.id,
        workflow,
        steps: [],
        result: execution.result,
        reused: true,
      };
    }

    if (execution.status !== "pending" && !canResumeRetryingExecution) {
      span.setAttribute("workflow.reused", true);
      span.addEvent("workflow.execution.reused", executionAttributes);
      return {
        executionId: execution.id,
        workflow,
        steps: [],
        result: execution.result,
        reused: true,
      };
    }

    span.addEvent("workflow.execution.created", executionAttributes);

    const running = await this.executionManager.start(execution.id);
    span.setAttribute("workflow.reused", false);
    span.addEvent("workflow.execution.started", getExecutionTelemetryAttributes(workflow, running));
    const steps: WorkflowStepResult[] = [];

    await this.recordLog(running.id, "info", "Workflow execution started", {
      workflowName: workflow.name,
    });

    try {
      for (const step of workflow.steps) {
        const stepAttributes = {
          "workflow.name": workflow.name,
          "workflow.execution.id": running.id,
          "workflow.step.name": step.name,
          "workflow.step.task": step.task,
        };
        span.addEvent("workflow.step.started", stepAttributes);
        await this.recordLog(running.id, "info", "Workflow step started", {
          step: step.name,
          task: step.task,
        });

        let result: unknown;
        try {
          result = await this.taskRunner.execute(
            step.task,
            this.resolveStepInput(workflow, running, payload, step, steps),
            {
              parentId: running.id,
              metadata: {
                workflowName: workflow.name,
                workflowExecutionId: running.id,
                workflowStep: step.name,
              },
            },
          );
        } catch (error) {
          span.addEvent("workflow.step.failed", {
            ...stepAttributes,
            "workflow.error.message": error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
        span.addEvent("workflow.step.completed", stepAttributes);

        steps.push({
          step: step.name,
          task: step.task,
          result,
        });

        await this.recordLog(running.id, "info", "Workflow step completed", {
          step: step.name,
          task: step.task,
        });
      }

      const result = {
        workflowName: workflow.name,
        steps,
      };
      const completed = await this.executionManager.complete(running.id, result);
      span.addEvent(
        "workflow.execution.completed",
        getExecutionTelemetryAttributes(workflow, completed),
      );
      await this.recordLog(running.id, "info", "Workflow execution completed", {
        workflowName: workflow.name,
      });

      return {
        executionId: completed.id,
        workflow,
        steps,
        result,
        reused: false,
      };
    } catch (error) {
      await this.recordLog(running.id, "error", "Workflow execution failed", {
        workflowName: workflow.name,
        error: error instanceof Error ? error.message : String(error),
      });
      const failed = await this.executionManager.fail(running.id, toExecutionError(error));
      span.addEvent("workflow.execution.failed", {
        ...getExecutionTelemetryAttributes(workflow, failed),
        "workflow.error.message": error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async cancel(executionId: string, reason?: string): Promise<Execution> {
    return this.executionManager.cancel(executionId, reason);
  }

  async replay(executionId: string, params?: ReplayExecutionParams): Promise<Execution> {
    if (!supportsReplay(this.executionManager)) {
      throw new WorkflowReplayUnsupportedProblem();
    }

    return this.executionManager.replay(executionId, params);
  }

  private getWorkflow(name: string): WorkflowDefinition {
    const workflow = this.registry.get(name);
    if (!workflow) {
      throw new WorkflowNotFoundProblem(name);
    }
    return workflow;
  }

  private resolveIdempotencyKey(
    workflow: WorkflowDefinition,
    payload: unknown,
  ): string | undefined {
    const resolver = workflow.options.idempotencyKey;

    if (typeof resolver === "function") {
      return resolver({ workflow, payload });
    }

    return resolver;
  }

  private resolveStepInput(
    workflow: WorkflowDefinition,
    workflowExecution: Execution,
    payload: unknown,
    step: WorkflowDefinition["steps"][number],
    previousResults: readonly WorkflowStepResult[],
  ): unknown {
    if (!step.input) {
      return payload;
    }

    const context: WorkflowStepContext = {
      workflow,
      workflowExecutionId: workflowExecution.id,
      payload,
      step,
      previousResults,
    };

    return step.input(context);
  }

  private async recordLog(
    executionId: string,
    level: "info" | "error",
    message: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!supportsRecordLog(this.executionManager)) {
      return;
    }

    await this.executionManager.recordLog(executionId, {
      level,
      message,
      data,
    });
  }
}
