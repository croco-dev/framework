import type { AuthProvider, AuthRequest, AuthUser } from "@croco/auth-core";
import { getHeaderValue } from "@croco/auth-core";
import { Component } from "@croco/framework-context";

@Component()
export class TestAuthProvider implements AuthProvider<AuthRequest> {
  async authenticate(request: AuthRequest): Promise<AuthUser | null> {
    if (getHeaderValue(request, "x-api-key") !== "test-key") {
      return null;
    }

    const user = {
      id: "test-user",
      tenantId: "test",
      roles: [],
      permissions: [],
      metadata: { tenantId: "test" },
    };

    return user;
  }
}
