import { Problem, ProblemCategory } from "@croco/problems-core";

export class RedisProblem extends Problem {
  constructor(operation: string, originalError?: Error | string) {
    const originalMessage =
      typeof originalError === "string" ? originalError : originalError?.message;

    super(
      "metering/redis-error",
      ProblemCategory.InternalServerError,
      `Redis operation '${operation}' failed: ${originalMessage ?? "Unknown error"}`,
      {
        extensions: {
          operation,
          originalMessage,
        },
      },
    );
  }
}
