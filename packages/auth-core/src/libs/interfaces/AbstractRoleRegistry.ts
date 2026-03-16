export type { RoleDefinition } from '../rbac/Role';

export abstract class AbstractRoleRegistry {
  abstract getRolePermissions(name: string, visited?: Set<string>): string[];
}
