import type { TaskReference } from "@croco/tasks-core";
import type {
  TypedWorkflowOptions,
  WorkflowBuilder,
  WorkflowOptions,
  WorkflowStepInputResolver,
  WorkflowTaskStepDeclaration,
} from "./types";

class WorkflowBuilderImpl {
  constructor(
    private readonly options: Omit<WorkflowOptions, "steps"> & { readonly name: string },
    private readonly steps: readonly WorkflowTaskStepDeclaration[],
  ) {}

  step(nameOrTask: unknown, taskOrInput?: unknown, namedInput?: unknown): WorkflowBuilderImpl {
    const isNamedStep = typeof nameOrTask === "string";
    const task = (isNamedStep ? taskOrInput : nameOrTask) as TaskReference;
    const input = (isNamedStep ? namedInput : taskOrInput) as WorkflowStepInputResolver | undefined;

    return new WorkflowBuilderImpl(this.options, [
      ...this.steps,
      {
        name: isNamedStep ? nameOrTask : task.name,
        task,
        ...(input === undefined ? {} : { input }),
      },
    ]);
  }

  build(): WorkflowOptions {
    return {
      ...this.options,
      steps: this.steps,
    };
  }
}

/**
 * Starts an immutable typed workflow definition whose steps preserve task contracts.
 */
export function defineWorkflow<TPayload>(
  options: TypedWorkflowOptions<TPayload>,
): WorkflowBuilder<TPayload, readonly []> {
  return new WorkflowBuilderImpl(
    options as unknown as Omit<WorkflowOptions, "steps"> & { readonly name: string },
    [],
  ) as unknown as WorkflowBuilder<TPayload, readonly []>;
}
