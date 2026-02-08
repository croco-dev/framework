import { Problem, ProblemCategory } from '@croco/problems-core';

export class LlmServiceProblem extends Problem {
  static readonly CODE = 'LLM_SERVICE_ERROR';

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
  static readonly CODE = 'MODEL_NOT_FOUND';

  constructor(modelId: string) {
    super(ModelNotFoundError.CODE, ProblemCategory.NotFound, `Model not found: ${modelId}`);
  }
}

export class GenerationError extends Problem {
  static readonly CODE = 'GENERATION_ERROR';

  constructor(message: string, cause?: Error) {
    const detail = cause ? `${message}: ${cause.message}` : message;
    super(GenerationError.CODE, ProblemCategory.InternalServerError, detail);
  }
}

export class EmbeddingError extends Problem {
  static readonly CODE = 'EMBEDDING_ERROR';

  constructor(message: string, cause?: Error) {
    const detail = cause ? `${message}: ${cause.message}` : message;
    super(EmbeddingError.CODE, ProblemCategory.InternalServerError, detail);
  }
}
