import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { GRAPHQL_GUARDS_KEY, GRAPHQL_INTERCEPTORS_KEY, GRAPHQL_ROLES_KEY } from "../libs/constants";
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
  it("should persist guard, interceptor, and role declarations used by the contract and runtime", () => {
    class TestResolver {
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
  });
});
