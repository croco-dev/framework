import "reflect-metadata";
import { ApolloServer } from "@apollo/server";
import {
  GraphQLAuthenticationProblem,
  GraphQLInternalError,
  GraphQLValidationProblem,
  problemToGraphQLError,
} from "@croco/protocols-graphql";
import { describe, expect, it } from "vitest";
import type { GraphQLResponse } from "@apollo/server";
import type { GraphQLFormattedError } from "graphql";
import { formatCrocoGraphQLError } from "./formatGraphQLError";

const privateDetail = "Stripe request failed at postgres://app:pw@db/prod";
const typeDefs = "type Query { checkout: String seats: String report: String me: String }";
const resolvers = {
  Query: {
    checkout: () => {
      throw new GraphQLInternalError("billing/gateway-failed", privateDetail);
    },
    seats: () => {
      throw new GraphQLValidationProblem("billing/seat-limit", "Seat limit reached", {
        max: 5,
        internalAccountId: "acct_internal_42",
      });
    },
    report: () => {
      throw new Error("connect ECONNREFUSED postgres://app:pw@db/prod");
    },
    me: () => {
      throw new GraphQLAuthenticationProblem("auth/session-expired", "Session expired");
    },
  },
};

function firstError(response: GraphQLResponse): GraphQLFormattedError {
  if (response.body.kind !== "single") throw new Error("expected a single GraphQL result");
  const [error] = response.body.singleResult.errors ?? [];
  if (!error) throw new Error("expected a GraphQL error");
  return error;
}

describe("GraphQL error formatting", () => {
  it("uses Croco redaction for Problems and masks other resolver errors", async () => {
    const server = new ApolloServer({ typeDefs, resolvers, formatError: formatCrocoGraphQLError });
    await server.start();
    try {
      for (const [field, problem] of [
        ["checkout", new GraphQLInternalError("billing/gateway-failed", privateDetail)],
        [
          "seats",
          new GraphQLValidationProblem("billing/seat-limit", "Seat limit reached", {
            max: 5,
            internalAccountId: "acct_internal_42",
          }),
        ],
        ["me", new GraphQLAuthenticationProblem("auth/session-expired", "Session expired")],
      ] as const) {
        const error = firstError(await server.executeOperation({ query: `{ ${field} }` }));
        const expected = problemToGraphQLError(problem, [field]).toJSON();
        expect(error).toMatchObject({
          message: expected.message,
          path: expected.path,
          extensions: expected.extensions,
        });
        expect(error.extensions).toEqual(expected.extensions);
        expect(error.locations).toEqual([{ line: 1, column: 3 }]);
      }

      const plain = firstError(await server.executeOperation({ query: "{ report }" }));
      expect(plain).toMatchObject({
        message: "An internal error occurred",
        path: ["report"],
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
      expect(plain.extensions).toEqual({ code: "INTERNAL_SERVER_ERROR" });
      expect(plain.locations).toEqual([{ line: 1, column: 3 }]);

      const invalid = firstError(await server.executeOperation({ query: "{ missing }" }));
      expect(invalid.extensions?.code).toBe("GRAPHQL_VALIDATION_FAILED");
      expect(invalid.message).toContain("Cannot query field");

      const malformed = firstError(await server.executeOperation({ query: "{ checkout" }));
      expect(malformed.extensions?.code).toBe("GRAPHQL_PARSE_FAILED");
      expect(malformed.message).toContain("Syntax Error");
    } finally {
      await server.stop();
    }
  });
});
