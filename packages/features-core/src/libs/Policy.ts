import { createHash } from "node:crypto";

import { PolicyValidationFailedProblem } from "./problems/PolicyProblems";

export type PolicyContext = Readonly<Record<string, unknown>>;

/** A tenant is part of the policy identity when present. `null` is the explicit app-wide scope. */
export type PolicyScope = {
  readonly app: string;
  readonly environment: string;
  readonly tenantId: string | null;
};

export type PolicyFieldInput = "text" | "number" | "boolean" | "datetime" | "select" | "json";

export type PolicyValidationDiagnostic = {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly path: string;
  readonly message: string;
};

export type PolicyValidationResult = {
  readonly valid: boolean;
  readonly diagnostics: readonly PolicyValidationDiagnostic[];
};

export type PolicySchema<_TValue> = {
  readonly version: string;
  readonly validate: (
    value: unknown,
  ) => PolicyValidationResult | readonly PolicyValidationDiagnostic[] | boolean;
};

/** A field descriptor is code-declared and is the only supported admin edit boundary. */
export type PolicyFieldDescriptor<TValue> = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly input: PolicyFieldInput;
  readonly min?: number;
  readonly max?: number;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  readonly sensitive?: boolean;
  readonly read: (value: TValue) => unknown;
  readonly write: (value: TValue, next: unknown) => TValue;
};

export type PolicySemanticDiff = {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly sensitive?: boolean;
};

export type PolicyEvaluation<
  TValue,
  TContext extends PolicyContext = PolicyContext,
  TResult = unknown,
> = (value: TValue, context: TContext) => TResult;

/**
 * The complete code registration for one parameterized policy. Functions are held in memory only;
 * persisted revisions carry the explicit registration fingerprint and never arbitrary code.
 */
export type ParameterizedPolicy<
  TValue,
  TContext extends PolicyContext = PolicyContext,
  TResult = unknown,
> = {
  readonly id: string;
  readonly schemaVersion: string;
  readonly schema: PolicySchema<TValue>;
  readonly fieldDescriptors: readonly PolicyFieldDescriptor<TValue>[];
  readonly codeRegistrationId: string;
  readonly registrationFingerprint?: string;
  readonly fallback?: TValue;
  readonly reviewRequirements?: {
    readonly risk: "low" | "financial";
    readonly independentReviewer: boolean;
  };
  readonly validate?: (
    value: unknown,
  ) => PolicyValidationResult | readonly PolicyValidationDiagnostic[] | boolean;
  readonly semanticDiff?: (before: TValue | null, after: TValue) => readonly PolicySemanticDiff[];
  readonly evaluate: PolicyEvaluation<TValue, TContext, TResult>;
};

export type PolicyDefinition<TValue> = Pick<
  ParameterizedPolicy<TValue>,
  | "id"
  | "schemaVersion"
  | "schema"
  | "fieldDescriptors"
  | "codeRegistrationId"
  | "reviewRequirements"
> & {
  readonly registrationFingerprint: string;
};

export type PolicyActor = {
  readonly id: string;
  readonly displayName?: string;
};

export type PolicyRevisionState = "draft" | "reviewed" | "scheduled" | "published" | "paused";

export type PolicyTransitionRecord = {
  readonly from: PolicyRevisionState | null;
  readonly to: PolicyRevisionState;
  readonly revision: number;
  readonly occurredAt: string;
  readonly actor: PolicyActor;
  readonly reason: string;
};

export type PolicyReview<TValue = unknown> = {
  readonly reviewedRevision: number;
  readonly reviewedHash: string;
  readonly reviewedValue: TValue;
  readonly validation: PolicyValidationResult;
  readonly semanticDiff: readonly PolicySemanticDiff[];
  readonly reviewedAt: string;
  readonly actor: PolicyActor;
  readonly reason: string;
};

export type PolicyPublication = {
  readonly version: number;
  readonly reviewedRevision: number;
  readonly reviewHash: string;
  readonly actor: PolicyActor;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly commandFingerprint: string;
  readonly effectiveAt: string;
  readonly publishedAt: string;
};

export type PolicyRevision<TValue = unknown> = {
  readonly id: string;
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly schemaVersion: string;
  readonly codeRegistrationId: string;
  readonly registrationFingerprint: string;
  readonly revision: number;
  /** Published revisions use their immutable revision as their policy version. */
  readonly version: number;
  readonly value: TValue;
  readonly hash: string;
  readonly state: PolicyRevisionState;
  readonly review?: PolicyReview<TValue>;
  readonly publication?: PolicyPublication;
  readonly scheduledFor?: string;
  readonly scheduleIdempotencyKey?: string;
  readonly fallback?: TValue;
  readonly pauseReason?: string;
  readonly rollbackOf?: number;
  readonly history: readonly PolicyTransitionRecord[];
};

export type PolicyDefinitionRecord = {
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly schemaVersion: string;
  readonly codeRegistrationId: string;
  readonly registrationFingerprint: string;
  readonly metadata?: unknown;
};

export type PolicyPublishCommand<TValue = unknown> = {
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly expectedRevision: number;
  readonly reviewHash: string;
  readonly actor: PolicyActor;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly effectiveAt?: string;
  readonly value?: TValue;
};

export type PolicyCommandReceipt = {
  readonly id: string;
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly revision: number;
  readonly version: number;
  readonly hash: string;
  readonly status: "published" | "scheduled" | "paused";
  readonly idempotencyKey: string;
  readonly commandFingerprint: string;
  readonly effectiveAt: string;
  readonly recordedAt: string;
};

export type PolicyPublicationInput<TValue = unknown> = {
  readonly revision: PolicyRevision<TValue>;
  readonly command: PolicyPublishCommand<TValue>;
  readonly receipt: PolicyCommandReceipt;
};

export type PolicyRevisionReference = {
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly version: number;
  readonly hash: string;
};

export type PolicyResolutionStatus =
  | "active"
  | "historical"
  | "paused"
  | "scheduled"
  | "unavailable";

export type PolicyResolution<TValue = unknown> = {
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly status: PolicyResolutionStatus;
  readonly version?: number;
  readonly hash?: string;
  readonly value?: TValue;
  readonly reason?: string;
  readonly reference?: PolicyRevisionReference;
};

export type PolicyScheduleState = "pending" | "claimed" | "completed" | "cancelled" | "failed";

export type PolicyScheduleRecord = {
  readonly id: string;
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly revision: number;
  readonly reviewHash: string;
  readonly effectiveAt: string;
  readonly idempotencyKey: string;
  readonly state: PolicyScheduleState;
  readonly executionId?: string;
  readonly triggerId?: string;
  readonly leaseUntil?: string;
  readonly claimedBy?: string;
  readonly lastError?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PolicyScheduleInput = {
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly revision: number;
  readonly reviewHash: string;
  readonly effectiveAt: string;
  readonly idempotencyKey: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type PolicyScheduleDelivery = {
  readonly scheduleId: string;
  readonly deliveryId: string;
  readonly receivedAt?: Date;
};

export type PolicyScheduleDeliveryResult = {
  readonly state: "completed" | "duplicate" | "claimed";
  readonly schedule: PolicyScheduleRecord;
  readonly receipt?: PolicyCommandReceipt;
  readonly executionId?: string;
};

export type PolicyEvaluationResult<TResult> = {
  readonly status: PolicyResolutionStatus;
  readonly value?: TResult;
  readonly version?: number;
  readonly hash?: string;
  readonly reason?: string;
  readonly reference?: PolicyRevisionReference;
};

export function normalizePolicyScope(scope: PolicyScope): PolicyScope {
  assertNonEmpty(scope.app, "scope.app");
  assertNonEmpty(scope.environment, "scope.environment");
  if (scope.tenantId === undefined)
    throw new TypeError("scope.tenantId must explicitly be null or a tenant identifier");
  if (scope.tenantId !== null) {
    assertNonEmpty(scope.tenantId, "scope.tenantId");
  }
  return {
    app: scope.app.trim(),
    environment: scope.environment.trim(),
    tenantId: scope.tenantId === null ? null : scope.tenantId.trim(),
  };
}

export function policyScopeKey(scope: PolicyScope): string {
  const normalized = normalizePolicyScope(scope);
  return stableStringify([normalized.app, normalized.environment, normalized.tenantId]);
}

export function policyRegistrationFingerprint<
  TValue,
  TContext extends PolicyContext = PolicyContext,
  TResult = unknown,
>(policy: ParameterizedPolicy<TValue, TContext, TResult>): string {
  if (policy.registrationFingerprint?.trim()) {
    return policy.registrationFingerprint;
  }
  return sha256(
    stableStringify({
      id: policy.id,
      schemaVersion: policy.schemaVersion,
      schemaVersionFromSchema: policy.schema.version,
      codeRegistrationId: policy.codeRegistrationId,
      reviewRequirements: policy.reviewRequirements,
      fields: policy.fieldDescriptors.map(({ id, input, sensitive, options }) => ({
        id,
        input,
        sensitive: sensitive === true,
        options: options?.map(({ value }) => value).sort(),
      })),
    }),
  );
}

export function policyValueHash<TValue>(
  policy: Pick<ParameterizedPolicy<TValue>, "id" | "schemaVersion" | "codeRegistrationId">,
  scope: PolicyScope,
  _revision: number,
  value: TValue,
): string {
  return sha256(
    stableStringify({
      policyId: policy.id,
      schemaVersion: policy.schemaVersion,
      codeRegistrationId: policy.codeRegistrationId,
      scope: normalizePolicyScope(scope),
      value,
    }),
  );
}

export function policySemanticDiff<
  TValue,
  TContext extends PolicyContext = PolicyContext,
  TResult = unknown,
>(
  policy: ParameterizedPolicy<TValue, TContext, TResult>,
  before: TValue | null,
  after: TValue,
): readonly PolicySemanticDiff[] {
  if (policy.semanticDiff) {
    return structuredClone(policy.semanticDiff(before, after));
  }
  if (before === null || stableStringify(before) !== stableStringify(after)) {
    return [{ field: "value", before, after }];
  }
  return [];
}

export function validatePolicyValue<
  TValue,
  TContext extends PolicyContext = PolicyContext,
  TResult = unknown,
>(policy: ParameterizedPolicy<TValue, TContext, TResult>, value: unknown): PolicyValidationResult {
  const diagnostics = [
    ...normalizeValidationResult(policy.schema.validate(value)),
    ...(policy.validate ? normalizeValidationResult(policy.validate(value)) : []),
  ];
  return {
    valid: diagnostics.every(({ severity }) => severity !== "error"),
    diagnostics,
  };
}

export function assertPolicyValue<
  TValue,
  TContext extends PolicyContext = PolicyContext,
  TResult = unknown,
>(policy: ParameterizedPolicy<TValue, TContext, TResult>, value: unknown): asserts value is TValue {
  const result = validatePolicyValue(policy, value);
  if (!result.valid) {
    throw new PolicyValidationFailedProblem(
      policy.id,
      result.diagnostics.map(({ code }) => code),
      result.diagnostics.map(({ code, path }) => ({ code, path })),
    );
  }
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function normalizeValidationResult(
  result: PolicyValidationResult | readonly PolicyValidationDiagnostic[] | boolean,
): readonly PolicyValidationDiagnostic[] {
  if (typeof result === "boolean") {
    return result
      ? []
      : [
          {
            code: "features/policy/schema-invalid",
            severity: "error",
            path: "value",
            message: "Policy value is invalid",
          },
        ];
  }
  if (Array.isArray(result)) return structuredClone(result);
  const validation = result as PolicyValidationResult;
  if (!validation.valid && !validation.diagnostics.some(({ severity }) => severity === "error"))
    return [
      {
        code: "features/policy/schema-invalid",
        severity: "error",
        path: "value",
        message: "Policy value is invalid",
      },
    ];
  return structuredClone(validation.diagnostics);
}

function assertNonEmpty(value: string, path: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${path} must not be empty`);
  }
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function policyCommandFingerprint(command: unknown): string {
  return sha256(stableStringify(command));
}
export function policyScheduleId(input: PolicyScheduleInput): string {
  return `policy-schedule:${createHash("sha256")
    .update(
      stableStringify([
        input.policyId,
        policyScopeKey(input.scope),
        input.revision,
        input.reviewHash,
        input.idempotencyKey,
      ]),
    )
    .digest("hex")}`;
}
export type PolicyDecisionInput<TValue = unknown> = {
  readonly id?: string;
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly version: number;
  readonly revision: number;
  readonly hash: string;
  readonly value?: TValue;
  readonly status: string;
  readonly reason?: string;
  readonly evaluatedAt?: string;
};
export type PolicyDecisionReference = {
  readonly decisionId: string;
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly version: number;
  readonly hash: string;
};

export type PolicyPauseInput<TValue = unknown> = {
  readonly revision: PolicyRevision<TValue>;
  readonly retainedDraft?: PolicyRevision<TValue>;
  readonly expectedActiveVersion: number;
  readonly command: {
    readonly action: "pause";
    readonly policyId: string;
    readonly scope: PolicyScope;
    readonly expectedRevision: number;
    readonly actor: PolicyActor;
    readonly reason: string;
    readonly idempotencyKey: string;
  };
  readonly receipt: PolicyCommandReceipt;
};
