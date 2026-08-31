import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 대량 색인 SQL chunk가 실패했을 때 안전한 원본 위치와 commit 범위를 제공합니다.
 */
export class BulkIndexChunkFailedProblem extends Problem {
  static readonly CODE = "search-drizzle/bulk-index-chunk-failed";

  constructor(
    chunkIndex: number,
    failedDocumentIndexes: readonly number[],
    committedDocumentIndexes: readonly number[],
    transactional: boolean,
    cause: unknown,
  ) {
    super(
      BulkIndexChunkFailedProblem.CODE,
      ProblemCategory.InternalServerError,
      `Bulk index chunk ${chunkIndex} failed`,
      {
        extensions: {
          chunkIndex,
          failedDocumentIndexes: [...failedDocumentIndexes],
          committedDocumentIndexes: [...committedDocumentIndexes],
          transactional,
        },
        ...(cause instanceof Error && { cause }),
      },
    );
  }
}

/**
 * 단일 문서가 안전한 PostgreSQL query parameter 예산을 초과했을 때 발생합니다.
 */
export class BulkIndexDocumentTooWideProblem extends Problem {
  static readonly CODE = "search-drizzle/bulk-index-document-too-wide";

  constructor(
    documentIndexes: readonly number[],
    parameterCount: number,
    maxParameterCount: number,
  ) {
    super(
      BulkIndexDocumentTooWideProblem.CODE,
      ProblemCategory.PayloadTooLarge,
      "Bulk index document exceeds the PostgreSQL parameter limit",
      {
        extensions: {
          documentIndexes: [...documentIndexes],
          parameterCount,
          maxParameterCount,
          retryable: false,
        },
      },
    );
  }
}
