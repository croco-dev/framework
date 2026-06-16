import { MetadataStorage } from "@croco/framework-context";
import { TaskRegistry } from "@croco/tasks-core";
import { type AnyTriggerMetadata, TriggerRegistry } from "@croco/triggers-core";
import { WORKFLOW_METADATA_KEY } from "./decorators/Workflow";
import {
  DuplicateWorkflowRegistrationProblem,
  WorkflowDefinitionProblem,
} from "./problems/WorkflowProblems";
import type {
  WorkflowDefinition,
  WorkflowMetadata,
  WorkflowTaskStep,
  WorkflowTaskStepDeclaration,
} from "./types";

export type WorkflowRegistryOptions = {
  readonly taskRegistry?: TaskRegistry;
  readonly triggerRegistry?: TriggerRegistry;
};

export class WorkflowRegistry {
  private readonly workflows = new Map<string, WorkflowDefinition>();

  constructor(
    workflows?: Iterable<WorkflowDefinition>,
    readonly taskRegistry: TaskRegistry = TaskRegistry.fromMetadata(),
  ) {
    for (const workflow of workflows ?? []) {
      this.register(workflow);
    }
  }

  static fromMetadata(options: WorkflowRegistryOptions = {}): WorkflowRegistry {
    const taskRegistry = options.taskRegistry ?? TaskRegistry.fromMetadata();
    const triggerRegistry = options.triggerRegistry ?? TriggerRegistry.getInstance();
    const registry = new WorkflowRegistry(undefined, taskRegistry);
    const triggerEntries = triggerRegistry.getAllTriggers();

    for (const entry of MetadataStorage.getAll<WorkflowMetadata>(WORKFLOW_METADATA_KEY)) {
      registry.register(
        WorkflowRegistry.createDefinition(entry.value, triggerEntries.get(entry.value.target)),
      );
    }

    return registry;
  }

  register(workflow: WorkflowDefinition): void {
    if (this.workflows.has(workflow.name)) {
      throw new DuplicateWorkflowRegistrationProblem(workflow.name);
    }

    this.assertTasksExist(workflow);
    this.workflows.set(workflow.name, workflow);
  }

  get(name: string): WorkflowDefinition | undefined {
    return this.workflows.get(name);
  }

  getAll(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  has(name: string): boolean {
    return this.workflows.has(name);
  }

  private assertTasksExist(workflow: WorkflowDefinition): void {
    for (const step of workflow.steps) {
      if (!this.taskRegistry.has(step.task)) {
        throw new WorkflowDefinitionProblem(
          workflow.name,
          `step '${step.name}' references unknown task '${step.task}'`,
        );
      }
    }
  }

  private static createDefinition(
    metadata: WorkflowMetadata,
    triggerEntries?: Map<string | symbol, AnyTriggerMetadata>,
  ): WorkflowDefinition {
    const methodName = String(metadata.methodName);
    const trigger = triggerEntries?.get(metadata.methodName);

    return {
      name: metadata.name,
      description: metadata.description,
      target: metadata.target,
      methodName,
      steps: metadata.options.steps.map((step) =>
        WorkflowRegistry.normalizeStep(metadata.name, step),
      ),
      triggers: trigger ? [trigger] : [],
      options: {
        maxAttempts: metadata.options.maxAttempts,
        timeout: metadata.options.timeout,
        idempotencyKey: metadata.options.idempotencyKey,
      },
    };
  }

  private static normalizeStep(
    workflowName: string,
    step: WorkflowTaskStepDeclaration,
  ): WorkflowTaskStep {
    if (typeof step === "string") {
      return {
        name: step,
        task: step,
      };
    }

    if (step.task.length === 0) {
      throw new WorkflowDefinitionProblem(workflowName, "workflow step task must not be empty");
    }

    return {
      name: step.name ?? step.task,
      task: step.task,
      input: step.input,
    };
  }
}
