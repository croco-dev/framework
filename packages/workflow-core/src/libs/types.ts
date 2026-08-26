import type { AnyTriggerMetadata } from "@croco/triggers-core";
import type {
  TaskReference,
  TaskReferenceName,
  TaskReferencePayload,
  TaskReferenceResult,
} from "@croco/tasks-core";

declare const TYPED_WORKFLOW_CONTRACT: unique symbol;

export type WorkflowIdempotencyContext<TPayload = unknown> = {
  readonly workflow: WorkflowDefinition;
  readonly payload: TPayload;
};

export type WorkflowIdempotencyResolver<TPayload = unknown> = (
  context: WorkflowIdempotencyContext<TPayload>,
) => string | undefined;

export type WorkflowStepContext<
  TPayload = unknown,
  TPreviousResults extends readonly WorkflowStepResult[] = readonly WorkflowStepResult[],
> = {
  readonly workflow: WorkflowDefinition;
  readonly workflowExecutionId: string;
  readonly payload: TPayload;
  readonly step: WorkflowTaskStep;
  readonly previousResults: TPreviousResults;
};

export type WorkflowStepInputResolver<
  TPayload = unknown,
  TPreviousResults extends readonly WorkflowStepResult[] = readonly WorkflowStepResult[],
  TInput = unknown,
> = (context: WorkflowStepContext<TPayload, TPreviousResults>) => TInput;

export type WorkflowTaskStepDeclaration =
  | string
  | {
      readonly name?: string;
      readonly task: string | TaskReference;
      readonly input?: WorkflowStepInputResolver;
    };

export type WorkflowTaskStep = {
  readonly name: string;
  readonly task: string;
  readonly input?: WorkflowStepInputResolver;
};

export type WorkflowOptions = {
  readonly name?: string;
  readonly description?: string;
  readonly steps: readonly WorkflowTaskStepDeclaration[];
  readonly maxAttempts?: number;
  readonly timeout?: number;
  readonly idempotencyKey?: string | WorkflowIdempotencyResolver;
};

export type WorkflowMetadata = {
  readonly name: string;
  readonly description?: string;
  readonly options: WorkflowOptions;
  readonly target: object;
  readonly methodName: string | symbol;
};

export type WorkflowDefinition = {
  readonly name: string;
  readonly description?: string;
  readonly target: object;
  readonly methodName: string;
  readonly steps: readonly WorkflowTaskStep[];
  readonly triggers: readonly AnyTriggerMetadata[];
  readonly options: {
    readonly maxAttempts?: number;
    readonly timeout?: number;
    readonly idempotencyKey?: string | WorkflowIdempotencyResolver;
  };
};

export type WorkflowStepResult<
  TStep extends string = string,
  TTask extends string = string,
  TResult = unknown,
> = {
  readonly step: TStep;
  readonly task: TTask;
  readonly result: TResult;
};

export type WorkflowCompletionResult<
  TSteps extends readonly WorkflowStepResult[] = readonly WorkflowStepResult[],
> = {
  readonly workflowName: string;
  readonly steps: TSteps;
};

export type WorkflowRunResult = {
  readonly executionId: string;
  readonly workflow: WorkflowDefinition;
  readonly steps: readonly WorkflowStepResult[];
  readonly result?: unknown;
  readonly reused: boolean;
};

type TypedWorkflowRunResultCommon = {
  readonly executionId: string;
  readonly workflow: WorkflowDefinition;
};

export type TypedWorkflowRunResult<TSteps extends readonly WorkflowStepResult[]> =
  | (TypedWorkflowRunResultCommon & {
      readonly steps: TSteps;
      readonly result: WorkflowCompletionResult<TSteps>;
      readonly reused: false;
    })
  | (TypedWorkflowRunResultCommon & {
      readonly steps: readonly [];
      readonly result?: unknown;
      readonly reused: true;
    });

export type TypedWorkflowReference<
  TPayload,
  TSteps extends readonly WorkflowStepResult[],
> = WorkflowOptions & {
  readonly name: string;
  readonly [TYPED_WORKFLOW_CONTRACT]?: {
    readonly payload: TPayload;
    readonly steps: TSteps;
  };
};

export type TypedWorkflowOptions<TPayload> = Omit<
  WorkflowOptions,
  "steps" | "idempotencyKey" | "name"
> & {
  readonly name: string;
  readonly idempotencyKey?: string | WorkflowIdempotencyResolver<TPayload>;
};

type WorkflowStepResolverArguments<
  TPayload,
  TPreviousResults extends readonly WorkflowStepResult[],
  TTask extends TaskReference,
> = [TPayload] extends [TaskReferencePayload<TTask>]
  ? [input?: WorkflowStepInputResolver<TPayload, TPreviousResults, TaskReferencePayload<TTask>>]
  : [input: WorkflowStepInputResolver<TPayload, TPreviousResults, TaskReferencePayload<TTask>>];

type WorkflowStepResultsWith<
  TPreviousResults extends readonly WorkflowStepResult[],
  TStep extends string,
  TTask extends TaskReference,
> = readonly [
  ...TPreviousResults,
  WorkflowStepResult<TStep, TaskReferenceName<TTask>, TaskReferenceResult<TTask>>,
];

export interface WorkflowBuilder<TPayload, TPreviousResults extends readonly WorkflowStepResult[]> {
  step<TTask extends TaskReference>(
    task: TTask,
    ...resolver: WorkflowStepResolverArguments<TPayload, TPreviousResults, TTask>
  ): WorkflowBuilder<
    TPayload,
    WorkflowStepResultsWith<TPreviousResults, TaskReferenceName<TTask>, TTask>
  >;

  step<const TName extends string, TTask extends TaskReference>(
    name: TName,
    task: TTask,
    ...resolver: WorkflowStepResolverArguments<TPayload, TPreviousResults, TTask>
  ): WorkflowBuilder<TPayload, WorkflowStepResultsWith<TPreviousResults, TName, TTask>>;

  build(): TypedWorkflowReference<TPayload, TPreviousResults>;
}
