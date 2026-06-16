import type { AnyTriggerMetadata } from "@croco/triggers-core";

export type WorkflowIdempotencyContext = {
  readonly workflow: WorkflowDefinition;
  readonly payload: unknown;
};

export type WorkflowIdempotencyResolver = (
  context: WorkflowIdempotencyContext,
) => string | undefined;

export type WorkflowStepContext = {
  readonly workflow: WorkflowDefinition;
  readonly workflowExecutionId: string;
  readonly payload: unknown;
  readonly step: WorkflowTaskStep;
  readonly previousResults: readonly WorkflowStepResult[];
};

export type WorkflowStepInputResolver = (context: WorkflowStepContext) => unknown;

export type WorkflowTaskStepDeclaration =
  | string
  | {
      readonly name?: string;
      readonly task: string;
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

export type WorkflowStepResult = {
  readonly step: string;
  readonly task: string;
  readonly result: unknown;
};

export type WorkflowRunResult = {
  readonly executionId: string;
  readonly workflow: WorkflowDefinition;
  readonly steps: readonly WorkflowStepResult[];
  readonly result?: unknown;
  readonly reused: boolean;
};
