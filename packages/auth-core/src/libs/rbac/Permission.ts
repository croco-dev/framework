import {
  InvalidPermissionActionProblem,
  InvalidPermissionFormatProblem,
} from "../problems/AuthProblems";

export type PermissionAction = "read" | "write" | "delete" | "manage";

export type Permission = {
  resource: string;
  action: PermissionAction;
  resourceId?: string;
};

const VALID_ACTIONS = ["read", "write", "delete", "manage"] as const;

function isPermissionAction(action: string): action is PermissionAction {
  return VALID_ACTIONS.some((validAction) => validAction === action);
}

function parsePermissionParts(
  permission: string,
): [resource: string, action: string, resourceId?: string] {
  const parts = permission.split(":");
  if (parts.length < 2 || parts.length > 3) {
    throw new InvalidPermissionFormatProblem(permission);
  }

  const [resource, action, resourceId] = parts;

  if (!resource || !action) {
    throw new InvalidPermissionFormatProblem(permission);
  }

  if (parts.length === 3 && !resourceId) {
    throw new InvalidPermissionFormatProblem(permission);
  }

  return [resource, action, resourceId];
}

export function parsePermission(permission: string): Permission {
  const [resource, action, resourceId] = parsePermissionParts(permission);

  if (!isPermissionAction(action)) {
    throw new InvalidPermissionActionProblem(action);
  }

  return { resource, action, resourceId };
}

export function formatPermission(permission: Permission): string {
  if (permission.resourceId === "") {
    throw new InvalidPermissionFormatProblem(
      `${permission.resource}:${permission.action}:${permission.resourceId}`,
    );
  }

  if (permission.resourceId !== undefined) {
    return `${permission.resource}:${permission.action}:${permission.resourceId}`;
  }
  return `${permission.resource}:${permission.action}`;
}

export function hasPermission(userPermissions: string[], required: string): boolean {
  parsePermissionParts(required);

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
      if (userPerm.action !== "manage" && userPerm.action !== requiredPerm.action) {
        return false;
      }
      if (requiredPerm.resourceId === undefined) {
        return userPerm.resourceId === undefined;
      }
      return userPerm.resourceId === undefined || userPerm.resourceId === requiredPerm.resourceId;
    } catch {
      console.warn("Malformed permission string:", p);
      return false;
    }
  });
}

export function hasResourcePermission(
  userPermissions: string[],
  resource: string,
  action: PermissionAction,
  resourceId?: string,
): boolean {
  const required =
    resourceId === undefined ? `${resource}:${action}` : `${resource}:${action}:${resourceId}`;
  return hasPermission(userPermissions, required);
}

export function getResourcePermissions(
  userPermissions: string[],
  resource: string,
): Array<{ action: PermissionAction; resourceId?: string }> {
  const result: Array<{ action: PermissionAction; resourceId?: string }> = [];

  for (const p of userPermissions) {
    try {
      const perm = parsePermission(p);
      if (perm.resource === resource) {
        result.push({ action: perm.action, resourceId: perm.resourceId });
      }
    } catch {
      console.warn("Malformed permission string:", p);
    }
  }

  return result;
}

export function hasAnyPermission(
  userPermissions: string[],
  requiredPermissions: string[],
): boolean {
  return requiredPermissions.some((perm) => hasPermission(userPermissions, perm));
}

export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: string[],
): boolean {
  return requiredPermissions.every((perm) => hasPermission(userPermissions, perm));
}
