import type { RequestContext } from "@croco/framework-context";
import { Token } from "@croco/framework-context";
import type { ImpersonationRevocationResult, ImpersonationState } from "./types";

export type ImpersonationPrincipal = {
  readonly id: string;
  readonly permissions: readonly string[];
};

export type ImpersonationSessionCreateResult =
  | { readonly status: "created" }
  | { readonly status: "active-session-exists" };

export abstract class ImpersonationStore {
  static readonly token = new Token<ImpersonationStore>("ImpersonationStore");

  /**
   * Atomically claims the session's impersonator and persists the session when no active session
   * owns that actor key. Persistent stores must enforce this boundary with a uniqueness constraint
   * or equivalent compare-and-set that replaces an expired owner in the same operation.
   */
  abstract createIfNoActiveSession(
    session: ImpersonationState,
  ): Promise<ImpersonationSessionCreateResult>;
  abstract find(sessionId: string): Promise<ImpersonationState | null>;
  abstract findByImpersonator(impersonatorId: string): Promise<ImpersonationState | null>;
  abstract revoke(
    sessionId: string,
    impersonatorId: string,
  ): Promise<ImpersonationRevocationResult>;
}

export abstract class AuthProvider {
  static readonly token = new Token<AuthProvider>("AuthProvider");

  abstract resolvePrincipal(context: RequestContext): Promise<ImpersonationPrincipal | null>;
  abstract targetExists(context: RequestContext, targetUserId: string): Promise<boolean>;
}
