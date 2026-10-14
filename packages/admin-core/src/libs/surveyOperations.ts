import {
  SurveyInvalidProblem,
  validateSurveyDefinition,
  validateSurveyScope,
} from "@croco/research-core";
import type { SurveyDefinition, SurveyScope, SurveyPermission } from "@croco/research-core";

export type SurveyAdminAccess = Readonly<{
  scope: SurveyScope;
  actor: string;
  permissions: readonly SurveyPermission[];
}>;
export type SurveyPublishRequest = Readonly<{
  definition: SurveyDefinition;
  expectedRevision: number;
  reason: string;
  idempotencyKey: string;
}>;
/** Shape validation only. SurveyManager independently authorizes the server principal. */
export function validateSurveyPublishRequest(input: SurveyPublishRequest): void {
  if (!input || typeof input !== "object") throw new SurveyInvalidProblem("publication");
  validateSurveyDefinition(input.definition);
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0 ||
    typeof input.reason !== "string" ||
    !input.reason.trim() ||
    input.reason.length > 1000 ||
    typeof input.idempotencyKey !== "string" ||
    !input.idempotencyKey.trim() ||
    input.idempotencyKey.length > 256
  )
    throw new SurveyInvalidProblem("publication metadata");
}
export function validateSurveyAdminAccess(access: SurveyAdminAccess): void {
  validateSurveyScope(access.scope);
  if (
    typeof access.actor !== "string" ||
    !access.actor.trim() ||
    !Array.isArray(access.permissions)
  )
    throw new SurveyInvalidProblem("admin context");
}
