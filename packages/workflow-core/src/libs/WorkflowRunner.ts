import type {
  Execution,
  ExecutionInspectionManager,
  ExecutionManager,
  ExecutionReplayManager,
  ReplayExecutionParams,
} from "@croco/execution-core";
import { TaskRunner } from "@croco/tasks-core";
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
    const workflow = this.getWorkflow(workflowName);
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

    if (idempotencyKey !== undefined && execution.metadata?.workflowInvocationId !== invocationId) {
      return {
        executionId: execution.id,
        workflow,
        steps: [],
        result: execution.result,
        reused: true,
      };
    }

    if (execution.status !== "pending") {
      return {
        executionId: execution.id,
        workflow,
        steps: [],
        result: execution.result,
        reused: true,
      };
    }

    const running = await this.executionManager.start(execution.id);
    const steps: WorkflowStepResult[] = [];

    await this.recordLog(running.id, "info", "Workflow execution started", {
      workflowName: workflow.name,
    });

    try {
      for (const step of workflow.steps) {
        await this.recordLog(running.id, "info", "Workflow step started", {
          step: step.name,
          task: step.task,
        });

        const result = await this.taskRunner.execute(
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
      await this.executionManager.fail(running.id, toExecutionError(error));
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
