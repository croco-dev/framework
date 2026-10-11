import { randomUUID } from "node:crypto";
import { Component } from "@croco/framework-context";
import type { AuthProvider, AuthUser } from "@croco/auth-core";

export const LOCAL_IDENTITIES = {
  alice: { id: "alice", tenantId: "studio-a", roles: [], permissions: [] },
  bob: { id: "bob", tenantId: "studio-b", roles: [], permissions: [] },
  carol: { id: "carol", tenantId: "studio-a", roles: [], permissions: [] },
} as const satisfies Record<string, AuthUser>;

export const SESSION_COOKIE = "croco_trial_session";

export function localDemoEnabled(): boolean {
  return process.env.CROCO_WEB_DEMO === "local";
}

export function isLocalSameOrigin(request: Request): boolean {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (!host || !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host)) return false;
  const origin = `${url.protocol}//${host}`;
  return request.headers.get("origin") === origin;
}

@Component()
export class LocalSessionProvider implements AuthProvider<Request> {
  private readonly sessions = new Map<string, { user: AuthUser; expiresAt: number }>();

  issue(identity: keyof typeof LOCAL_IDENTITIES): string {
    const token = randomUUID();
    this.sessions.set(token, {
      user: LOCAL_IDENTITIES[identity],
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
    return token;
  }

  async authenticate(request: Request): Promise<AuthUser | null> {
    if (!localDemoEnabled()) return null;
    const token = request.headers
      .get("cookie")
      ?.split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1);
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return session.user;
  }
}
