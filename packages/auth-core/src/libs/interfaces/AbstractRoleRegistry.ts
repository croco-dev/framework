export type { RoleDefinition } from "../rbac/RoleDefinition";

export abstract class AbstractRoleRegistry {
  abstract getRolePermissions(name: string, visited?: Set<string>): string[];
}
