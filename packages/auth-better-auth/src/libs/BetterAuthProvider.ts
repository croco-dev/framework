import type { AuthProvider, AuthUser } from '@croco/auth-core';
import { Component } from '@croco/framework-context';
import type { BetterAuthFactory } from './BetterAuthFactory';
import { BetterAuthInvalidSessionProblem } from './problems/BetterAuthInvalidSessionProblem';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringArray(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function mergeStringArrays(...values: unknown[]): string[] {
  const merged = new Set<string>();

  for (const value of values) {
    for (const item of toStringArray(value)) {
      merged.add(item);
    }
  }

  return [...merged];
}

function getNestedValue(source: Record<string, unknown>, key: string): unknown {
  const directValue = source[key];
  if (directValue !== undefined) {
    return directValue;
  }

  const nestedSources = [
    source.metadata,
    source.userMetadata,
    source.privateMetadata,
    source.publicMetadata,
    source.rbac,
  ];

  for (const nestedSource of nestedSources) {
    if (!isRecord(nestedSource)) {
      continue;
    }

    const nestedValue = nestedSource[key];
    if (nestedValue !== undefined) {
      return nestedValue;
    }
  }

  return undefined;
}

function extractRoles(user: Record<string, unknown>): string[] {
  return mergeStringArrays(getNestedValue(user, 'roles'), getNestedValue(user, 'role'));
}

function extractPermissions(user: Record<string, unknown>): string[] {
  return mergeStringArrays(getNestedValue(user, 'permissions'), getNestedValue(user, 'permission'));
}

@Component()
export class BetterAuthProvider implements AuthProvider<Request> {
  constructor(private readonly factory: BetterAuthFactory) {}

  async authenticate(request: Request): Promise<AuthUser | null> {
    const auth = this.factory.getAuth();

    // better-auth's api.getSession expects headers
    // Using internal API method to verify session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return null;
    }

    const { user } = session;
    const userRecord = isRecord(user) ? user : null;

    if (!userRecord || typeof userRecord.id !== 'string') {
      throw new BetterAuthInvalidSessionProblem();
    }

    return {
      id: userRecord.id,
      email: typeof userRecord.email === 'string' ? userRecord.email : undefined,
      roles: extractRoles(userRecord),
      permissions: extractPermissions(userRecord),
      metadata: {
        image: userRecord.image,
        emailVerified: userRecord.emailVerified,
      },
    };
  }
}
