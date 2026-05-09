import { AbstractRoleRegistry } from '../interfaces/AbstractRoleRegistry';
import type { RoleDefinition } from './RoleDefinition';

export class RoleRegistry extends AbstractRoleRegistry {
  private roles = new Map<string, RoleDefinition>();

  register(role: RoleDefinition): void {
    this.roles.set(role.name, role);
  }

  getRole(name: string): RoleDefinition | undefined {
    return this.roles.get(name);
  }

  getRolePermissions(name: string, visited: Set<string> = new Set()): string[] {
    if (visited.has(name)) {
      return [];
    }
    visited.add(name);

    const role = this.getRole(name);
    if (!role) {
      return [];
    }

    const permissions = new Set<string>(role.permissions);

    if (role.inherits) {
      for (const parentRole of role.inherits) {
        const parentPermissions = this.getRolePermissions(parentRole, visited);
        for (const perm of parentPermissions) {
          permissions.add(perm);
        }
      }
    }

    return Array.from(permissions);
  }
}
