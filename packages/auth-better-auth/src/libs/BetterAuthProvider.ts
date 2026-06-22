import type { AuthProvider, AuthUser } from "@croco/auth-core";
import { Component } from "@croco/framework-context";
import type { BetterAuthFactory } from "./BetterAuthFactory";
import { BetterAuthAuthenticationProblem } from "./problems/BetterAuthAuthenticationProblem";
import { BetterAuthInvalidSessionProblem } from "./problems/BetterAuthInvalidSessionProblem";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringArray(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
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
  return mergeStringArrays(getNestedValue(user, "roles"), getNestedValue(user, "role"));
}

function extractPermissions(user: Record<string, unknown>): string[] {
  return mergeStringArrays(getNestedValue(user, "permissions"), getNestedValue(user, "permission"));
}

function extractString(user: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getNestedValue(user, key);
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

/**
 * Better Auth 세션을 읽어 Croco의 {@link AuthUser}로 변환하는 인증 제공자입니다.
 */
@Component()
export class BetterAuthProvider implements AuthProvider<Request> {
  constructor(private readonly factory: BetterAuthFactory) {}

  async authenticate(request: Request): Promise<AuthUser | null> {
    const auth = this.factory.getAuth();

    let session: unknown;

    try {
      // better-auth's api.getSession expects headers.
      session = await auth.api.getSession({
        headers: request.headers,
      });
    } catch (error) {
      if (isInvalidAuthenticationError(error)) {
        return null;
      }

      throw new BetterAuthAuthenticationProblem("authenticate", error);
    }

    if (!session) {
      return null;
    }

    if (!isRecord(session)) {
      throw new BetterAuthInvalidSessionProblem();
    }

    const { user } = session;
    const userRecord = isRecord(user) ? user : null;

    if (!userRecord || typeof userRecord.id !== "string") {
      throw new BetterAuthInvalidSessionProblem();
    }

    const orgId = extractString(userRecord, "orgId", "org_id", "organizationId", "organization_id");
    const tenantId = extractString(userRecord, "tenantId", "tenant_id");

    return {
      id: userRecord.id,
      email: typeof userRecord.email === "string" ? userRecord.email : undefined,
      roles: extractRoles(userRecord),
      permissions: extractPermissions(userRecord),
      metadata: {
        image: userRecord.image,
        emailVerified: userRecord.emailVerified,
        ...(orgId !== undefined ? { orgId } : {}),
        ...(tenantId !== undefined ? { tenantId } : {}),
      },
    };
  }
}

function isInvalidAuthenticationError(error: unknown): boolean {
  const statusCode = getNumericProperty(error, "statusCode") ?? getNumericProperty(error, "status");

  if (statusCode !== undefined) {
    return statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404;
  }

  const status = getStringProperty(error, "status");
  return (
    status === "UNAUTHORIZED" ||
    status === "FORBIDDEN" ||
    status === "NOT_FOUND" ||
    status === "BAD_REQUEST"
  );
}

function getNumericProperty(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const property = value[key];
  return typeof property === "number" ? property : undefined;
}

function getStringProperty(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const property = value[key];
  return typeof property === "string" ? property : undefined;
}
