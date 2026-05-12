import type { ImpersonationContext } from "./ImpersonationService";
import type { ImpersonationState } from "./types";

export function withImpersonationAudit(
  metadata: Record<string, unknown>,
  context: ImpersonationContext | Record<string, unknown>,
): Record<string, unknown> {
  if ("impersonation" in context && context.impersonation) {
    const imp = context.impersonation as ImpersonationState;
    return {
      ...metadata,
      impersonatorId: imp.impersonatorId,
      impersonationSessionId: imp.sessionId,
    };
  }
  return metadata;
}
