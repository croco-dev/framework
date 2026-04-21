import { InvalidPermissionActionProblem, InvalidPermissionFormatProblem } from '../problems/AuthProblems';

export type PermissionAction = 'read' | 'write' | 'delete' | 'manage';

export type Permission = {
  resource: string;
  action: PermissionAction;
  resourceId?: string;
};

const VALID_ACTIONS = ['read', 'write', 'delete', 'manage'] as const;

function isPermissionAction(action: string): action is PermissionAction {
  return VALID_ACTIONS.some((validAction) => validAction === action);
}

export function parsePermission(permission: string): Permission {
  const parts = permission.split(':');
  if (parts.length < 2 || parts.length > 3) {
    throw new InvalidPermissionFormatProblem(permission);
  }

  const [resource, action, resourceId] = parts;

  if (!resource || !action) {
    throw new InvalidPermissionFormatProblem(permission);
  }

  if (!isPermissionAction(action)) {
    throw new InvalidPermissionActionProblem(action);
  }

  return { resource, action, resourceId };
}

export function formatPermission(permission: Permission): string {
  if (permission.resourceId) {
    return `${permission.resource}:${permission.action}:${permission.resourceId}`;
  }
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
      if (userPerm.action !== requiredPerm.action) {
        return false;
      }
      if (requiredPerm.resourceId) {
        return userPerm.resourceId === requiredPerm.resourceId || userPerm.resourceId === undefined;
      }
      return true;
    } catch {
      return false;
    }
  });
}

export function hasResourcePermission(
  userPermissions: string[],
  resource: string,
  action: PermissionAction,
  resourceId?: string
): boolean {
  const required = resourceId ? `${resource}:${action}:${resourceId}` : `${resource}:${action}`;
  return hasPermission(userPermissions, required);
}

export function getResourcePermissions(
  userPermissions: string[],
  resource: string
): Array<{ action: PermissionAction; resourceId?: string }> {
  const result: Array<{ action: PermissionAction; resourceId?: string }> = [];

  for (const p of userPermissions) {
    try {
      const perm = parsePermission(p);
      if (perm.resource === resource) {
        result.push({ action: perm.action, resourceId: perm.resourceId });
      }
    } catch {
      // Intentionally ignored: skip malformed permission strings
    }
  }

  return result;
}

export function hasAnyPermission(userPermissions: string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.some((perm) => hasPermission(userPermissions, perm));
}

export function hasAllPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.every((perm) => hasPermission(userPermissions, perm));
}
