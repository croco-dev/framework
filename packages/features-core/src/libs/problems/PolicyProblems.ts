import { Problem, ProblemCategory } from "@croco/problems-core";

import type { PolicyRevisionState } from "../PolicyRevisionState";

export type PolicyProblemCode =
  | "invalid-definition"
  | "registration-missing"
  | "registration-conflict"
  | "schema-version-mismatch"
  | "revision-not-found"
  | "revision-conflict"
  | "stale-review"
  | "invalid-transition"
  | "authorization-denied"
  | "idempotency-conflict"
  | "invalid-schedule"
  | "activation-conflict"
  | "validation-failed"
  | "unavailable";

const POLICY_PROBLEMS = {
  "invalid-definition": {
    code: "features/policy/invalid-definition",
    category: ProblemCategory.ValidationError,
  },
  "registration-missing": {
    code: "features/policy/registration-missing",
    category: ProblemCategory.NotFound,
  },
  "registration-conflict": {
    code: "features/policy/registration-conflict",
    category: ProblemCategory.Conflict,
  },
  "schema-version-mismatch": {
    code: "features/policy/schema-version-mismatch",
    category: ProblemCategory.Conflict,
  },
  "revision-not-found": {
    code: "features/policy/revision-not-found",
    category: ProblemCategory.NotFound,
  },
  "revision-conflict": {
    code: "features/policy/revision-conflict",
    category: ProblemCategory.Conflict,
  },
  "stale-review": {
    code: "features/policy/stale-review",
    category: ProblemCategory.Conflict,
  },
  "invalid-transition": {
    code: "features/policy/invalid-transition",
    category: ProblemCategory.BusinessRuleViolation,
  },
  "authorization-denied": {
    code: "features/policy/authorization-denied",
    category: ProblemCategory.Forbidden,
  },
  "idempotency-conflict": {
    code: "features/policy/idempotency-conflict",
    category: ProblemCategory.Conflict,
  },
  "invalid-schedule": {
    code: "features/policy/invalid-schedule",
    category: ProblemCategory.BadRequest,
  },
  "activation-conflict": {
    code: "features/policy/activation-conflict",
    category: ProblemCategory.Conflict,
  },
  "validation-failed": {
    code: "features/policy/validation-failed",
    category: ProblemCategory.ValidationError,
  },
  unavailable: {
    code: "features/policy/unavailable",
    category: ProblemCategory.Conflict,
  },
} satisfies Record<
  PolicyProblemCode,
  { readonly code: string; readonly category: ProblemCategory }
>;

export class PolicyProblem extends Problem {
  readonly code: string;
  readonly category: ProblemCategory;

  constructor(
    problemCode: PolicyProblemCode,
    detail: string,
    extensions?: Record<string, unknown>,
    options?: { readonly cause?: Error },
  ) {
    const metadata = POLICY_PROBLEMS[problemCode];
    super(metadata.code, metadata.category, detail, {
      ...(extensions ? { extensions } : {}),
      ...options,
    });
    this.code = metadata.code;
    this.category = metadata.category;
  }
}

export class InvalidPolicyDefinitionProblem extends PolicyProblem {
  constructor(detail: string) {
    super("invalid-definition", detail);
  }
}

export class PolicyRegistrationMissingProblem extends PolicyProblem {
  constructor(policyId: string, schemaVersion?: string) {
    super(
      "registration-missing",
      `Policy registration '${policyId}'${schemaVersion ? ` schema '${schemaVersion}'` : ""} is not available`,
      { policyId, ...(schemaVersion ? { schemaVersion } : {}) },
    );
  }
}

export class PolicyRegistrationConflictProblem extends PolicyProblem {
  constructor(policyId: string, schemaVersion: string) {
    super(
      "registration-conflict",
      `Policy registration '${policyId}' schema '${schemaVersion}' conflicts with an existing registration`,
      {
        policyId,
        schemaVersion,
      },
    );
  }
}

export class PolicySchemaVersionMismatchProblem extends PolicyProblem {
  constructor(policyId: string, expected: string, actual: string) {
    super(
      "schema-version-mismatch",
      `Policy '${policyId}' requires schema '${expected}', received '${actual}'`,
      {
        policyId,
        expectedSchemaVersion: expected,
        actualSchemaVersion: actual,
      },
    );
  }
}

export class PolicyRevisionNotFoundProblem extends PolicyProblem {
  constructor(policyId: string, revision: number | string) {
    super("revision-not-found", `Policy '${policyId}' revision '${revision}' was not found`, {
      policyId,
      revision,
    });
  }
}

export class PolicyRevisionConflictProblem extends PolicyProblem {
  constructor(policyId: string, expected: number, actual: number) {
    super(
      "revision-conflict",
      `Policy '${policyId}' revision ${actual} does not match expected revision ${expected}`,
      {
        policyId,
        expectedRevision: expected,
        actualRevision: actual,
      },
    );
  }
}

export class PolicyStaleReviewProblem extends PolicyProblem {
  constructor(policyId: string, expectedHash: string, actualHash: string) {
    void expectedHash;
    void actualHash;
    super("stale-review", `Policy '${policyId}' review hash does not match the current draft`, {
      policyId,
    });
  }
}

export class PolicyInvalidTransitionProblem extends PolicyProblem {
  constructor(policyId: string, from: PolicyRevisionState | null, to: PolicyRevisionState) {
    super(
      "invalid-transition",
      `Policy '${policyId}' cannot transition from '${from}' to '${to}'`,
      {
        policyId,
        from,
        to,
      },
    );
  }
}

export class PolicyAuthorizationProblem extends PolicyProblem {
  constructor(policyId: string, action: string) {
    super("authorization-denied", `Policy '${policyId}' authorization denied for '${action}'`, {
      policyId,
      action,
    });
  }
}

export class PolicyIdempotencyConflictProblem extends PolicyProblem {
  constructor(policyId: string, idempotencyKey: string) {
    void idempotencyKey;
    super(
      "idempotency-conflict",
      `Policy '${policyId}' idempotency key conflicts with a different command`,
      {
        policyId,
      },
    );
  }
}

export class PolicyScheduleProblem extends PolicyProblem {
  constructor(policyId: string, detail: string) {
    super("invalid-schedule", `Policy '${policyId}' schedule is invalid: ${detail}`, { policyId });
  }
}

export class PolicyActivationConflictProblem extends PolicyProblem {
  constructor(policyId: string, scopeKey: string) {
    super(
      "activation-conflict",
      `Policy '${policyId}' has a concurrent activation for scope '${scopeKey}'`,
      {
        policyId,
        scopeKey,
      },
    );
  }
}

export class PolicyValidationFailedProblem extends PolicyProblem {
  constructor(
    policyId: string,
    diagnostics: readonly string[],
    details?: readonly { readonly code: string; readonly path: string }[],
  ) {
    super("validation-failed", `Policy '${policyId}' failed validation`, {
      policyId,
      diagnosticCodes: [...diagnostics].sort(),
      ...(details ? { diagnostics: details } : {}),
    });
  }
}

export class PolicyUnavailableProblem extends PolicyProblem {
  constructor(policyId: string, reason: string) {
    super("unavailable", `Policy '${policyId}' is unavailable: ${reason}`, { policyId, reason });
  }
}
