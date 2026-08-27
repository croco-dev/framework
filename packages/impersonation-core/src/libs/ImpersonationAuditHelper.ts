import { resolveActiveImpersonationContext } from "@croco/audit-core";
import type { ImpersonationContext } from "./ImpersonationService";

export function withImpersonationAudit(
  metadata: Record<string, unknown>,
  context: ImpersonationContext | Record<string, unknown>,
): Record<string, unknown> {
  const imp = resolveActiveImpersonationContext(context);
  if (!imp) {
    return metadata;
  }

  return {
    ...metadata,
    impersonatorId: imp.impersonatorId,
    impersonationSessionId: imp.sessionId,
  };
}
