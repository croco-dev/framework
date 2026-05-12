import "reflect-metadata";
import type { Guard } from "@croco/framework-context";
import { REST_ROLES_KEY } from "../constants";
import type { ExecutionContext } from "../interfaces/ExecutionContext";

export type UserWithRoles = {
  roles?: string[];
};

/**
 * `@Roles` 메타데이터와 요청 사용자 역할을 비교해 접근을 제어하는 Guard입니다.
 */
export class RolesGuard implements Guard<ExecutionContext> {
  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const target = context.getClass();

    const requiredRoles = Reflect.getMetadata(REST_ROLES_KEY, target, handler) as
      | string[]
      | undefined;

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.getRequest() as { user?: UserWithRoles };
    const userRoles = request.user?.roles ?? [];

    return requiredRoles.some((role) => userRoles.includes(role));
  }
}
