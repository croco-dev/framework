import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import { GraphQLServerNotInitializedProblem } from "../libs/problems/GraphQLTransportProblems";

describe("GraphQLTransportProblems", () => {
  it("serializes the GraphQL server initialization detail", () => {
    const detail = "Custom initialization detail";
    const problem = new GraphQLServerNotInitializedProblem(detail);

    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.toJSON()).toMatchObject({
      code: "transports-graphql/server-not-initialized",
      detail,
    });
  });
});
