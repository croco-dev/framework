import type { RequestContext } from "@croco/framework-context";
import { Token } from "@croco/framework-context";
import type { ImpersonationState } from "./types";

export abstract class ImpersonationStore {
  static readonly token = new Token<ImpersonationStore>("ImpersonationStore");

  abstract save(session: ImpersonationState): Promise<void>;
  abstract find(sessionId: string): Promise<ImpersonationState | null>;
  abstract findByImpersonator(impersonatorId: string): Promise<ImpersonationState | null>;
  abstract revoke(sessionId: string): Promise<void>;
}

export abstract class AuthProvider {
  static readonly token = new Token<AuthProvider>("AuthProvider");

  abstract getCurrentUserId(context: RequestContext): string | null;
}
