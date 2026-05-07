export type RoleDefinition = {
  name: string;
  permissions: string[];
  inherits?: string[];
};
