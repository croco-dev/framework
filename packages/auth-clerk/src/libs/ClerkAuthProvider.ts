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

      const orgRole = getStringClaim(payload, "org_role");
      const roles: string[] = orgRole ? [orgRole] : [];
      const permissions = getStrictStringArrayClaim(payload, "org_permissions");

      return {
        id: userId,
        email: getStringClaim(payload, "email"),
        roles,
        permissions,
        metadata: {
          clerkUserId: userId,
          orgId: getStringClaim(payload, "org_id"),
          orgRole,
          orgSlug: getStringClaim(payload, "org_slug"),
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
