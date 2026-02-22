import { createClerkClient, verifyToken } from '@clerk/backend';
import type { AuthProvider, AuthUser } from '@croco/auth-core';

export type ClerkAuthOptions = {
  secretKey: string;
  publishableKey?: string;
};

export class ClerkAuthProvider implements AuthProvider<Request> {
  constructor(private options: ClerkAuthOptions) {
    this.clerkClient = createClerkClient({ secretKey: options.secretKey, publishableKey: options.publishableKey });
  }

  async authenticate(request: Request): Promise<AuthUser | null> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return null;
    }

    try {
      const verified = await verifyToken(token, { secretKey: this.options.secretKey });
      const userId = verified.sub;
      const payload = verified as unknown as Record<string, unknown>;

      const roles: string[] = typeof payload.org_role === 'string' ? [payload.org_role] : [];
      const permissions: string[] = Array.isArray(payload.org_permissions) ? (payload.org_permissions as string[]) : [];

      return {
        id: userId,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        roles,
        permissions,
        metadata: {
          clerkUserId: userId,
          orgId: payload.org_id,
          orgRole: payload.org_role,
          orgSlug: payload.org_slug,
          sessionId: payload.sid,
        },
      };
    } catch {
      return null;
    }
  }
}
