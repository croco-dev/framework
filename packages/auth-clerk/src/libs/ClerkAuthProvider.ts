import { verifyToken } from "@clerk/backend";
import type { AuthProvider, AuthUser } from "@croco/auth-core";
import {
  ClerkMalformedClaimProblem,
  createClerkTokenVerificationProblem,
} from "./problems/ClerkProblems";
import type { AuthorizationHeaderCarrier } from "./types";

export type ClerkAuthOptions = {
  secretKey: string;
  publishableKey?: string;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringClaim(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

function getStrictStringArrayClaim(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ClerkMalformedClaimProblem(key);
  }

  const parsed: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      throw new ClerkMalformedClaimProblem(key);
    }
    parsed.push(item);
  }

  return parsed;
}

function getV2OrganizationClaims(payload: Record<string, unknown>): {
  orgId: string | undefined;
  orgRole: string | undefined;
  orgSlug: string | undefined;
  permissions: string[];
} {
  const organization = payload.o;
  if (organization === undefined) {
    return { orgId: undefined, orgRole: undefined, orgSlug: undefined, permissions: [] };
  }

  if (!isObjectRecord(organization) || Array.isArray(organization)) {
    throw new ClerkMalformedClaimProblem("o");
  }

  const { id, rol, slg, per, fpm } = organization;
  if (
    typeof id !== "string" ||
    typeof rol !== "string" ||
    typeof slg !== "string" ||
    typeof per !== "string" ||
    typeof fpm !== "string"
  ) {
    throw new ClerkMalformedClaimProblem("o");
  }

  const featureClaim = payload.fea;
  if (featureClaim !== undefined && typeof featureClaim !== "string") {
    throw new ClerkMalformedClaimProblem("fea");
  }

  const features = featureClaim
    ? featureClaim
        .split(",")
        .map((feature) => feature.trim().split(":"))
        .filter(([scope]) => scope.includes("o"))
        .map(([, feature]) => feature)
    : [];
  const permissionNames = per ? per.split(",").map((permission) => permission.trim()) : [];
  const permissionMaps = fpm ? fpm.split(",") : [];
  const permissions: string[] = [];

  for (const [featureIndex, feature] of features.entries()) {
    const encodedMap = permissionMaps[featureIndex]?.trim();
    if (encodedMap === undefined) {
      continue;
    }
    if (!/^\d+$/.test(encodedMap)) {
      throw new ClerkMalformedClaimProblem("o");
    }

    const bitmap = Number(encodedMap);
    if (!Number.isSafeInteger(bitmap)) {
      throw new ClerkMalformedClaimProblem("o");
    }
    for (const [permissionIndex, permission] of permissionNames.entries()) {
      if (Math.floor(bitmap / 2 ** permissionIndex) % 2 === 1) {
        permissions.push(`org:${feature}:${permission}`);
      }
    }
  }

  return {
    orgId: id,
    orgRole: rol ? `org:${rol}` : undefined,
    orgSlug: slg,
    permissions,
  };
}

export class ClerkAuthProvider implements AuthProvider<AuthorizationHeaderCarrier> {
  constructor(private options: ClerkAuthOptions) {}

  async authenticate(request: AuthorizationHeaderCarrier): Promise<AuthUser | null> {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return null;
    }

    try {
      const verified = await verifyToken(token, { secretKey: this.options.secretKey });
      if (!isObjectRecord(verified)) {
        throw new ClerkMalformedClaimProblem("sub");
      }

      const userId = getStringClaim(verified, "sub");
      if (!userId) {
        throw new ClerkMalformedClaimProblem("sub");
      }

      const payload = verified;

      const organization =
        payload.v === 2
          ? getV2OrganizationClaims(payload)
          : {
              orgId: getStringClaim(payload, "org_id"),
              orgRole: getStringClaim(payload, "org_role"),
              orgSlug: getStringClaim(payload, "org_slug"),
              permissions: getStrictStringArrayClaim(payload, "org_permissions"),
            };
      const orgRole = organization.orgRole;
      const roles: string[] = orgRole ? [orgRole] : [];

      return {
        id: userId,
        email: getStringClaim(payload, "email"),
        roles,
        permissions: organization.permissions,
        metadata: {
          clerkUserId: userId,
          orgId: organization.orgId,
          orgRole,
          orgSlug: organization.orgSlug,
          sessionId: getStringClaim(payload, "sid"),
        },
      };
    } catch (error) {
      if (error instanceof ClerkMalformedClaimProblem) {
        throw error;
      }

      throw createClerkTokenVerificationProblem(error);
    }
  }
}
