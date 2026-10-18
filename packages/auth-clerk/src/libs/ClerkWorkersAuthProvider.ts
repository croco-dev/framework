import type { AuthProvider, AuthUser, TenantMappingProvider } from "@croco/auth-core";
import { ClerkAuthProvider, type ClerkAuthOptions } from "./ClerkAuthProvider";
import { ClerkSessionProvider } from "./ClerkSessionProvider";
import {
  ClerkExternalServiceProblem,
  ClerkTokenVerificationProblem,
  ClerkTokenVerificationUpstreamProblem,
} from "./problems/ClerkProblems";

export type ClerkWorkersAuthOptions = ClerkAuthOptions & {
  /** Trusted server configuration; request headers cannot choose the accepted audience or origin. */
  readonly audience: string;
  readonly authorizedParties: string[];
  /** Resolve the verified organization through the existing authoritative tenant mapping. */
  readonly tenantMapping?: TenantMappingProvider;
  /** Server-resolved target tenant. Return null when the route requires a tenant but none is resolved. */
  readonly resolveTargetTenant?: (request: Request) => Promise<string | null>;
};

/** Cookie/bearer auth with a fresh upstream session check on every authenticated request. */
export class ClerkWorkersAuthProvider extends ClerkAuthProvider implements AuthProvider<Request> {
  private readonly sessions: ClerkSessionProvider;
  private readonly workerOptions: ClerkWorkersAuthOptions;

  constructor(options: ClerkWorkersAuthOptions) {
    const snapshot = { ...options, authorizedParties: [...(options.authorizedParties ?? [])] };
    super(snapshot);
    if (
      !options.secretKey?.trim() ||
      !options.audience?.trim() ||
      !options.authorizedParties?.length ||
      options.authorizedParties.some((party) => !party.trim()) ||
      (options.resolveTargetTenant !== undefined && options.tenantMapping === undefined)
    ) {
      throw new ClerkExternalServiceProblem("Invalid Clerk Workers configuration", {
        extensions: { diagnosticCode: "auth-clerk/workers-missing-config", retryable: false },
      });
    }
    this.workerOptions = snapshot;
    this.sessions = new ClerkSessionProvider(this.workerOptions);
  }

  protected override validateClaims(payload: Record<string, unknown>): void {
    super.validateClaims(payload);
    if (
      typeof payload.azp !== "string" ||
      !this.workerOptions.authorizedParties.includes(payload.azp) ||
      payload.sts === "pending"
    )
      throw new ClerkTokenVerificationProblem();
  }

  override async authenticate(request: Request): Promise<AuthUser | null> {
    const headers = new Headers(request.headers);
    // An explicitly supplied Authorization header never falls back to a cookie.
    if (!headers.has("Authorization")) {
      const cookies = (headers.get("Cookie") ?? "")
        .split(";")
        .map((cookie) => cookie.trim())
        .filter((cookie) => cookie.startsWith("__session="));
      if (cookies.length > 1) throw new ClerkTokenVerificationProblem();
      const cookie = cookies[0]?.slice("__session=".length);
      if (cookie) {
        const origin = headers.get("Origin");
        if (
          (origin !== null && !this.workerOptions.authorizedParties.includes(origin)) ||
          (!["GET", "HEAD", "OPTIONS"].includes(request.method) && origin === null)
        ) {
          throw new ClerkTokenVerificationProblem();
        }
        headers.set("Authorization", `Bearer ${cookie}`);
      }
    }
    if (
      headers.has("Authorization") &&
      !/^Bearer [^\s]+$/.test(headers.get("Authorization") ?? "")
    ) {
      throw new ClerkTokenVerificationProblem();
    }
    let user: AuthUser | null;
    try {
      user = await super.authenticate({ headers });
    } catch (error) {
      // SDK error messages may contain unlabeled tokens/keys. Keep only the stable classification.
      if (error instanceof ClerkTokenVerificationProblem) throw new ClerkTokenVerificationProblem();
      if (error instanceof ClerkTokenVerificationUpstreamProblem) {
        throw new ClerkTokenVerificationUpstreamProblem({
          status: error.extensions?.upstreamStatus ?? 503,
        });
      }
      throw error;
    }
    if (user === null) return null;
    const sessionId = user.metadata?.sessionId;
    if (typeof sessionId !== "string" || !sessionId) throw new ClerkTokenVerificationProblem();
    const session = await this.sessions.getSession(sessionId);
    if (
      !session ||
      session.status !== "active" ||
      session.id !== sessionId ||
      session.userId !== user.id ||
      !session.expireAt ||
      !Number.isFinite(session.expireAt.getTime()) ||
      session.expireAt.getTime() <= Date.now()
    ) {
      throw new ClerkTokenVerificationProblem();
    }
    if (this.workerOptions.tenantMapping) {
      const orgId = user.metadata?.orgId;
      const tenantId =
        typeof orgId === "string" ? await this.workerOptions.tenantMapping.resolve(orgId) : null;
      const target = await this.workerOptions.resolveTargetTenant?.(request);
      if (!tenantId || (this.workerOptions.resolveTargetTenant && target !== tenantId)) {
        throw new ClerkTokenVerificationProblem();
      }
      return { ...user, tenantId };
    }
    return user;
  }
}
