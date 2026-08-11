import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  LlmCompletion,
  LlmCompletionEventDeliveryState,
  LlmCompletionEventIntent,
} from "../LlmCompletionEvents";

export type { LlmCompletionEventDeliveryState } from "../LlmCompletionEvents";
export type LlmCompletionEventFailureStage =
  | "load_delivery_state"
  | "record_pending"
  | "publish"
  | "mark_published";

export class LlmCompletionEventPublicationProblem extends Problem {
  static readonly CODE = "llm-core/completion-event-publication-failed";

  constructor(
    readonly completion: LlmCompletion,
    readonly intent: LlmCompletionEventIntent,
    readonly deliveryState: LlmCompletionEventDeliveryState,
    readonly durableIntentRecorded: boolean,
    cause: unknown,
    readonly failureStage: LlmCompletionEventFailureStage = "publish",
  ) {
    const causeError = cause instanceof Error ? cause : new Error(String(cause));
    super(
      LlmCompletionEventPublicationProblem.CODE,
      ProblemCategory.Conflict,
      `LLM ${completion.operation} completed, but completion event '${intent.eventName}' was not durably confirmed`,
      {
        cause: causeError,
        extensions: {
          chunksDelivered: completion.operation === "stream",
          deliveryState,
          durableIntentRecorded,
          failureStage,
          eventDeliveryRetryable: true,
          eventId: intent.eventId,
          eventName: intent.eventName,
          modelExecutionCompleted: true,
          retryable: false,
          ...(failureStage === "publish"
            ? {}
            : {
                intentStoreError: causeError.message,
                intentStoreOperation: failureStage,
              }),
        },
      },
    );
  }
}

export class LlmServiceProblem extends Problem {
  static readonly CODE = "LLM_SERVICE_ERROR";

  constructor(message: string, cause?: Error) {
    const detail = cause ? `${message}: ${cause.message}` : message;
    super(LlmServiceProblem.CODE, ProblemCategory.InternalServerError, detail);
  }

  static fromError(error: unknown): LlmServiceProblem {
    if (error instanceof LlmServiceProblem) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    return new LlmServiceProblem(message, error instanceof Error ? error : undefined);
  }
}

export class ModelNotFoundError extends Problem {
  static readonly CODE = "MODEL_NOT_FOUND";

  constructor(modelId: string) {
    super(ModelNotFoundError.CODE, ProblemCategory.NotFound, `Model not found: ${modelId}`);
  }
}

export class GenerationError extends Problem {
  static readonly CODE = "GENERATION_ERROR";

  constructor(message: string, cause?: Error) {
    const detail = cause ? `${message}: ${cause.message}` : message;
    super(GenerationError.CODE, ProblemCategory.InternalServerError, detail);
  }
}

export class EmbeddingError extends Problem {
  static readonly CODE = "EMBEDDING_ERROR";

  constructor(message: string, cause?: Error) {
    const detail = cause ? `${message}: ${cause.message}` : message;
    super(EmbeddingError.CODE, ProblemCategory.InternalServerError, detail);
  }
}

export class LlmStructuredOutputProblem extends Problem {
  static readonly CODE = "STRUCTURED_OUTPUT_ERROR";

  constructor(message: string, cause?: Error) {
    const detail = cause ? `${message}: ${cause.message}` : message;
    super(LlmStructuredOutputProblem.CODE, ProblemCategory.InternalServerError, detail);
  }
}

export class LlmToolExecutionProblem extends Problem {
  static readonly CODE = "TOOL_EXECUTION_ERROR";

  constructor(message: string, cause?: Error) {
    const detail = cause ? `${message}: ${cause.message}` : message;
    super(LlmToolExecutionProblem.CODE, ProblemCategory.InternalServerError, detail);
  }
}
