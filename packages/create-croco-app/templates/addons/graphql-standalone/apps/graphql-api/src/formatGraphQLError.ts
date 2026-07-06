import { unwrapResolverError } from "@apollo/server/errors";
import type { GraphQLFormattedError } from "graphql";

type CrocoProblemLike = Error & {
  readonly code: string;
  readonly status: number;
  readonly title: string;
  readonly type: string;
  readonly instance?: string;
  readonly extensions?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCrocoProblemLike(error: unknown): error is CrocoProblemLike {
  if (!(error instanceof Error)) {
    return false;
  }

  const candidate = error as Partial<CrocoProblemLike>;

  return (
    typeof candidate.code === "string" &&
    typeof candidate.status === "number" &&
    typeof candidate.title === "string" &&
    typeof candidate.type === "string"
  );
}

export function formatCrocoGraphQLError(
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const originalError = unwrapResolverError(error);

  if (!isCrocoProblemLike(originalError)) {
    return formattedError;
  }

  return {
    ...formattedError,
    extensions: {
      ...formattedError.extensions,
      ...(isRecord(originalError.extensions) ? originalError.extensions : {}),
      code: originalError.code,
      status: originalError.status,
      title: originalError.title,
      type: originalError.type,
      ...(typeof originalError.instance === "string" ? { instance: originalError.instance } : {}),
    },
  };
}
