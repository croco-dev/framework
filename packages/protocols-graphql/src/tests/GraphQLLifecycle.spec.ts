import "reflect-metadata";
import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  GRAPHQL_GUARDS_KEY,
  GRAPHQL_INTERCEPTORS_KEY,
  GRAPHQL_PROBLEM_RESPONSES_KEY,
  GRAPHQL_ROLES_KEY,
} from "../libs/constants";
import { GraphQLProblemResponse } from "../libs/decorators/GraphQLProblemResponse";
import { Roles } from "../libs/decorators/Roles";
import { UseGuards, UseInterceptors } from "../libs/decorators/Lifecycle";
import type { GraphQLGuard } from "../libs/types/GuardTypes";
import type {
  GraphQLCallHandler,
  GraphQLInterceptor,
  GraphQLInterceptorContext,
} from "../libs/types/InterceptorTypes";

class TestGuard implements GraphQLGuard {
  canActivate(): boolean {
    return true;
  }
}

class TestInterceptor implements GraphQLInterceptor {
  intercept(_context: GraphQLInterceptorContext, next: GraphQLCallHandler): Promise<unknown> {
    return next.handle();
  }
}

describe("GraphQL lifecycle decorators", () => {
  it("should persist method declarations on the resolver prototype", () => {
    class TestResolver {
      @GraphQLProblemResponse({
        code: "GRAPHQL_PROTECTED_VALUE_UNAVAILABLE",
        category: ProblemCategory.InternalServerError,
      })
      @Roles("admin")
      @UseGuards(TestGuard)
      @UseInterceptors(TestInterceptor)
      protectedValue(): string {
        return "authorized";
      }
    }

    expect(
      Reflect.getMetadata(GRAPHQL_GUARDS_KEY, TestResolver.prototype, "protectedValue"),
    ).toEqual([TestGuard]);
    expect(
      Reflect.getMetadata(GRAPHQL_INTERCEPTORS_KEY, TestResolver.prototype, "protectedValue"),
    ).toEqual([TestInterceptor]);
    expect(
      Reflect.getMetadata(GRAPHQL_ROLES_KEY, TestResolver.prototype, "protectedValue"),
    ).toEqual(["admin"]);
    expect(
      Reflect.getOwnMetadata(
        GRAPHQL_PROBLEM_RESPONSES_KEY,
        TestResolver.prototype,
        "protectedValue",
      ),
    ).toEqual([
      expect.objectContaining({
        code: "GRAPHQL_PROTECTED_VALUE_UNAVAILABLE",
        category: ProblemCategory.InternalServerError,
      }),
    ]);
    expect(
      Reflect.hasOwnMetadata(GRAPHQL_PROBLEM_RESPONSES_KEY, TestResolver, "protectedValue"),
    ).toBe(false);
  });
});
