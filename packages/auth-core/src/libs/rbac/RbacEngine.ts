import type { AuthUser } from '../interfaces/AuthUser';
import { hasPermission } from './Permission';
import type { RoleRegistry } from './Role';

export class RbacEngine {
  constructor(private roleRegistry: RoleRegistry) {}

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
