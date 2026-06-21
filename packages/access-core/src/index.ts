// Types

// Engine
export { AccessEngine } from "./libs/AccessEngine.js";
export type { AccessEngineOptions } from "./libs/AccessEngine.js";
// Constants
export {
  ACCESS_METADATA_KEY,
  ACCESS_PROVIDER_TOKEN,
  MAX_TRAVERSAL_DEPTH,
} from "./libs/constants.js";
// Decorators
export { Access } from "./libs/decorators/Access.js";
// Guards
export { AccessGuard, BadRequestProblem, ForbiddenProblem } from "./libs/guards/AccessGuard.js";
export type { AccessProvider } from "./libs/interfaces/AccessProvider.js";
export {
  POLICY_DECISION_REDACTED_VALUE,
  POLICY_DECISION_TELEMETRY_EVENT,
  POLICY_DECISION_TRACE_VERSION,
  POLICY_DECISION_TRUNCATED_VALUE,
  addPolicyDecisionIdExtension,
  capturePolicyDecisionSourceLocation,
  createPolicyDecisionTrace,
  recordPolicyDecisionTrace,
  toPolicyDecisionTelemetryAttributes,
} from "./libs/PolicyDecisionTrace.js";
export type {
  PolicyDecisionRedactionOptions,
  PolicyDecisionResult,
  PolicyDecisionSourceLocation,
  PolicyDecisionTrace,
  PolicyDecisionTraceInput,
  PolicyDecisionTraceInputs,
  PolicyDecisionTraceRedaction,
  PolicyDecisionTraceSink,
  PolicyDecisionTraceValue,
  RecordPolicyDecisionTraceOptions,
} from "./libs/PolicyDecisionTrace.js";
// Interfaces
export type { AccessExecutionContext, AccessHttpContext } from "./libs/interfaces/Guard.js";
export type {
  CheckRequest,
  CheckResult,
  AccessRuleMetadata,
  GrantRequest,
  ListRequest,
  RelationTuple,
  RevokeRequest,
} from "./libs/types.js";
