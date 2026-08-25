import { Problem, ProblemCategory } from "@croco/problems-core";

/** Batch chunk sizes that cannot preserve bounded, exact chunking semantics. */
export class InvalidBatchChunkSizeProblem extends Problem {
  readonly code = "batch-core/invalid-chunk-size";
  readonly category = ProblemCategory.ValidationError;
  readonly receivedChunkSize: string;

  constructor(chunkSize: number) {
    const receivedChunkSize = String(chunkSize);
    super(
      "batch-core/invalid-chunk-size",
      ProblemCategory.ValidationError,
      `Batch step.chunkSize must be a positive safe integer; received ${receivedChunkSize}.`,
      {
        extensions: {
          receivedChunkSize,
          retryable: false,
        },
      },
    );
    this.receivedChunkSize = receivedChunkSize;
  }
}

/** Assert that a chunk size is bounded and exactly representable by JavaScript. */
export function assertValidChunkSize(chunkSize: number): void {
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new InvalidBatchChunkSizeProblem(chunkSize);
  }
}
