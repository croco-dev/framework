import "reflect-metadata";
import type { Guard } from "@croco/framework-context";
import { GRAPHQL_ROLES_KEY } from "../constants";
import type { GraphQLGuardContext } from "../types/GuardTypes";

export type UserWithRoles = {
  roles?: string[];
};

export class GraphQLRolesGuard implements Guard<GraphQLGuardContext> {
  canActivate(context: GraphQLGuardContext): boolean {
    const resolver = context.root;
    const methodName = context.info.fieldName;

    const requiredRoles = Reflect.getMetadata(GRAPHQL_ROLES_KEY, resolver, methodName) as
      | string[]
      | undefined;

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const ctx = context.context as { user?: UserWithRoles };
    const userRoles = ctx.user?.roles ?? [];

    return requiredRoles.some((role) => userRoles.includes(role));
  }
}
