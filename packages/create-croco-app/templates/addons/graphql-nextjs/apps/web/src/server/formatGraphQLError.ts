import { unwrapResolverError } from "@apollo/server/errors";
import { isProblem, problemToGraphQLError } from "@croco/protocols-graphql";
import type { GraphQLFormattedError } from "graphql";

export function formatCrocoGraphQLError(
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const originalError = unwrapResolverError(error);

  if (isProblem(originalError)) {
    return {
      ...problemToGraphQLError(originalError, formattedError.path).toJSON(),
      locations: formattedError.locations,
    };
  }

  if (formattedError.extensions?.code === "INTERNAL_SERVER_ERROR") {
    return {
      ...formattedError,
      message: "An internal error occurred",
      extensions: { code: "INTERNAL_SERVER_ERROR" },
    };
  }

  return formattedError;
}
