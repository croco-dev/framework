import type { AbstractRoleRegistry } from "../interfaces/AbstractRoleRegistry";
import type { AuthUser } from "../interfaces/AuthUser";
import { hasPermission } from "./Permission";

export class RbacEngine {
  constructor(private roleRegistry: AbstractRoleRegistry) {}

  hasPermission(user: AuthUser, permission: string): boolean {
    if (hasPermission(user.permissions, permission)) {
      return true;
    }

    for (const roleName of user.roles) {
      const rolePermissions = this.roleRegistry.getRolePermissions(roleName);
      if (hasPermission(rolePermissions, permission)) {
        return true;
      }
    }

    return false;
  }

  hasRole(user: AuthUser, role: string): boolean {
    return user.roles.includes(role);
  }
}
