import type { AuthProvider, AuthUser } from '@croco/auth-core';
import { Component } from '@croco/framework-context';
import type { BetterAuthFactory } from './BetterAuthFactory';

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

    return {
      id: user.id,
      email: user.email,
      roles: [], // TODO: map roles if RBAC plugin is used or from metadata
      permissions: [],
      metadata: {
        image: user.image,
        emailVerified: user.emailVerified,
      },
    };
  }
}
