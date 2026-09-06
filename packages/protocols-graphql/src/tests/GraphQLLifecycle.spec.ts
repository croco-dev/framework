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

  it("should preserve all guards and interceptors when stacking decorators on resolver methods", () => {
    class Guard1 implements GraphQLGuard {
      canActivate(): boolean {
        return true;
      }
    }
    class Guard2 implements GraphQLGuard {
      canActivate(): boolean {
        return true;
      }
    }
    class Interceptor1 implements GraphQLInterceptor {
      intercept(_context: GraphQLInterceptorContext, next: GraphQLCallHandler): Promise<unknown> {
        return next.handle();
      }
    }
    class Interceptor2 implements GraphQLInterceptor {
      intercept(_context: GraphQLInterceptorContext, next: GraphQLCallHandler): Promise<unknown> {
        return next.handle();
      }
    }

    class StackedResolver {
      @UseGuards(Guard1)
      @UseGuards(Guard2)
      @UseInterceptors(Interceptor1)
      @UseInterceptors(Interceptor2)
      resolveValue(): string {
        return "ok";
      }
    }

    expect(
      Reflect.getMetadata(GRAPHQL_GUARDS_KEY, StackedResolver.prototype, "resolveValue"),
    ).toEqual([Guard2, Guard1]);
    expect(
      Reflect.getMetadata(GRAPHQL_INTERCEPTORS_KEY, StackedResolver.prototype, "resolveValue"),
    ).toEqual([Interceptor2, Interceptor1]);
  });

  it("should preserve multiple guards across decorators with multiple arguments", () => {
    class G1 implements GraphQLGuard {
      canActivate(): boolean {
        return true;
      }
    }
    class G2 implements GraphQLGuard {
      canActivate(): boolean {
        return true;
      }
    }
    class G3 implements GraphQLGuard {
      canActivate(): boolean {
        return true;
      }
    }

    class MultiArgResolver {
      @UseGuards(G1)
      @UseGuards(G2, G3)
      testOp(): string {
        return "val";
      }
    }

    expect(Reflect.getMetadata(GRAPHQL_GUARDS_KEY, MultiArgResolver.prototype, "testOp")).toEqual([
      G2,
      G3,
      G1,
    ]);
  });
});
