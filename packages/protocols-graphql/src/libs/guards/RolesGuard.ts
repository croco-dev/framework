import "reflect-metadata";
import type { Guard } from "@croco/framework-context";
import { GRAPHQL_ROLES_KEY } from "../constants";
import { getGraphQLMethodMetadata } from "../metadata/GraphQLMetadata";
import type { GraphQLGuardContext } from "../types/GuardTypes";

export type UserWithRoles = {
  roles?: string[];
};

export class GraphQLRolesGuard implements Guard<GraphQLGuardContext> {
  constructor(
    private readonly resolverTarget?: object,
    private readonly resolverMethodName?: string,
  ) {}

  canActivate(context: GraphQLGuardContext): boolean {
    const resolver = this.resolverTarget ?? context.root;
    if (resolver === null || (typeof resolver !== "object" && typeof resolver !== "function")) {
      return false;
    }

    const methodName = this.resolverMethodName ?? context.info.fieldName;

    const requiredRoles = getGraphQLMethodMetadata<string[]>(
      GRAPHQL_ROLES_KEY,
      resolver,
      methodName,
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const ctx = context.context as { user?: { roles?: unknown } };
    const userRoles = ctx.user?.roles;

    return (
      Array.isArray(userRoles) &&
      requiredRoles.some((role) => Array.prototype.includes.call(userRoles, role))
    );
  }
}
