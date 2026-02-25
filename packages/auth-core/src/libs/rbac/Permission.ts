import { InvalidPermissionActionProblem, InvalidPermissionFormatProblem } from '../problems/AuthProblems';

export type Permission = {
  resource: string;
  action: 'read' | 'write' | 'delete' | 'manage';
};

const VALID_ACTIONS = ['read', 'write', 'delete', 'manage'] as const;

export function parsePermission(permission: string): Permission {
  const [resource, action] = permission.split(':');
  if (!resource || !action) {
    throw new InvalidPermissionFormatProblem(permission);
  }

  if (!VALID_ACTIONS.includes(action as Permission['action'])) {
    throw new InvalidPermissionActionProblem(action);
  }

  return { resource, action: action as Permission['action'] };
}

export function formatPermission(permission: Permission): string {
  return `${permission.resource}:${permission.action}`;
}

export function hasPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes(required)) {
    return true;
  }

  const requiredPerm = parsePermission(required);

  return userPermissions.some((p) => {
    try {
      const userPerm = parsePermission(p);

      if (userPerm.resource !== requiredPerm.resource) {
        return false;
      }
      if (userPerm.action === 'manage') {
        return true;
      }
      return userPerm.action === requiredPerm.action;
    } catch {
      return false;
    }
  });
}
