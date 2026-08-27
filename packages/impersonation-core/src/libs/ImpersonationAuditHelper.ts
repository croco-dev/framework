import { resolveImpersonationContext } from "@croco/audit-core";
import type { ImpersonationContext } from "./ImpersonationService";

export function withImpersonationAudit(
  metadata: Record<string, unknown>,
  context: ImpersonationContext | Record<string, unknown>,
): Record<string, unknown> {
  const resolution = resolveImpersonationContext(context);
  if (resolution.status !== "active") {
    return metadata;
  }
  const imp = resolution.state;

  return {
    ...metadata,
    impersonatorId: imp.impersonatorId,
    impersonationSessionId: imp.sessionId,
  };
}
