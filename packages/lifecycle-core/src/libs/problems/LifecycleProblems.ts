import { Problem, ProblemCategory } from "@croco/problems-core";
import type { MonetizationRecipeId, MonetizationSignalType } from "../types";

export class DuplicateLifecycleRuleProblem extends Problem {
  constructor(ruleId: string) {
    super(
      "lifecycle-core/duplicate-rule",
      ProblemCategory.InternalServerError,
      `Lifecycle rule '${ruleId}' is already registered`,
      {
        extensions: {
          ruleId,
          retryable: false,
        },
      },
    );
  }
}

export class LifecycleRuleDefinitionProblem extends Problem {
  constructor(ruleId: string, message: string) {
    super(
      "lifecycle-core/rule-definition-invalid",
      ProblemCategory.InternalServerError,
      `Lifecycle rule '${ruleId}' is invalid: ${message}`,
      {
        extensions: {
          ruleId,
          retryable: false,
        },
      },
    );
  }
}

export class LifecycleActionAdapterProblem extends Problem {
  constructor(message: string) {
    super("lifecycle-core/action-adapter-failed", ProblemCategory.InternalServerError, message, {
      extensions: {
        retryable: true,
      },
    });
  }
}

/** Indicates that a lifecycle dispatch could not be finalized under its original claim fence. */
export class LifecycleRunFinalizationProblem extends Problem {
  constructor(runId: string, reason: string) {
    super(
      "lifecycle-core/run-finalization-conflict",
      ProblemCategory.Conflict,
      `Lifecycle run '${runId}' could not finalize its dispatch evidence`,
      {
        extensions: {
          runId,
          reason,
          retryable: false,
          reconciliationRequired: true,
        },
      },
    );
  }
}

/** Indicates that lifecycle run evidence contains values that cannot be stored as a snapshot. */
export class LifecycleRunEvidenceProblem extends Problem {
  constructor(runId: string, actionId: string) {
    super(
      "lifecycle-core/run-evidence-invalid",
      ProblemCategory.ValidationError,
      `Lifecycle run '${runId}' action '${actionId}' contains unsupported evidence`,
      {
        extensions: {
          runId,
          actionId,
          retryable: false,
        },
      },
    );
  }
}

/** Indicates that the requested lifecycle rule version is not registered. */
export class UnknownLifecycleRuleVersionProblem extends Problem {
  constructor(ruleId: string, version: string) {
    super(
      "lifecycle-core/rule-version-unknown",
      ProblemCategory.NotFound,
      `Lifecycle rule '${ruleId}' version '${version}' is not registered`,
      {
        extensions: {
          ruleId,
          version,
          retryable: false,
        },
      },
    );
  }
}

/** Indicates that a registered lifecycle rule version has no executable registration. */
export class UnavailableLifecycleRuleVersionProblem extends Problem {
  constructor(ruleId: string, version: string) {
    super(
      "lifecycle-core/rule-version-unavailable",
      ProblemCategory.Conflict,
      `Lifecycle rule '${ruleId}' version '${version}' has no available executable registration`,
      {
        extensions: {
          ruleId,
          version,
          retryable: false,
        },
      },
    );
  }
}

/** Indicates that an optimistic lifecycle rule mutation used a stale revision. */
export class LifecycleRuleVersionConflictProblem extends Problem {
  constructor(ruleId: string, expectedRevision: number, actualRevision: number) {
    super(
      "lifecycle-core/rule-version-conflict",
      ProblemCategory.Conflict,
      `Lifecycle rule '${ruleId}' revision ${String(expectedRevision)} is stale`,
      {
        extensions: {
          ruleId,
          expectedRevision,
          actualRevision,
          retryable: true,
        },
      },
    );
  }
}

export class LifecycleRuleCommandConflictProblem extends Problem {
  constructor(commandId: string) {
    super(
      "lifecycle-core/rule-command-conflict",
      ProblemCategory.Conflict,
      `Lifecycle rule command '${commandId}' was reused with different input`,
      {
        extensions: {
          commandId,
          retryable: false,
        },
      },
    );
  }
}

export class LifecycleRuleTransitionProblem extends Problem {
  constructor(ruleId: string, version: string, state: string, command: string) {
    super(
      "lifecycle-core/rule-transition-invalid",
      ProblemCategory.Conflict,
      `Lifecycle rule '${ruleId}' version '${version}' cannot ${command} from state '${state}'`,
      {
        extensions: {
          ruleId,
          version,
          state,
          command,
          retryable: false,
        },
      },
    );
  }
}

/** Indicates that an immutable lifecycle rule version definition is invalid or has drifted. */
export class LifecycleRuleVersionDefinitionProblem extends Problem {
  constructor(ruleId: string, version: string, message: string) {
    super(
      "lifecycle-core/rule-version-definition-invalid",
      ProblemCategory.InternalServerError,
      `Lifecycle rule '${ruleId}' version '${version}' is invalid: ${message}`,
      {
        extensions: {
          ruleId,
          version,
          retryable: false,
        },
      },
    );
  }
}

export class LifecycleRuleActionContractProblem extends Problem {
  constructor(ruleId: string, version: string) {
    super(
      "lifecycle-core/rule-action-contract-mismatch",
      ProblemCategory.InternalServerError,
      `Lifecycle rule '${ruleId}' version '${version}' produced an undeclared action`,
      {
        extensions: {
          ruleId,
          version,
          retryable: false,
        },
      },
    );
  }
}

/**
 * Indicates that a lifecycle signal arrived without a durable source event identity.
 * The ingress boundary must issue one stable sourceEventId and preserve it on the
 * retryable envelope; the evaluator does not invent timestamps, payload hashes, or
 * per-attempt UUIDs as a fallback.
 */
export class MissingLifecycleSourceIdentityProblem extends Problem {
  readonly code = "lifecycle-core/source-identity-missing";
  readonly category = ProblemCategory.ValidationError;

  constructor(ruleId: string, version: string) {
    super(
      undefined,
      undefined,
      `Lifecycle rule '${ruleId}' version '${version}' requires a durable source event identity`,
      {
        extensions: {
          ruleId,
          version,
          retryable: false,
        },
      },
    );
  }
}

/**
 * Indicates that a redelivered source event carried a conflicting semantic payload.
 * Identity matches but the canonical payload fingerprint differs, so this is an
 * explicit conflict rather than a dedupe hit or a new event.
 */
export class LifecycleSourcePayloadConflictProblem extends Problem {
  readonly code = "lifecycle-core/source-payload-conflict";
  readonly category = ProblemCategory.Conflict;

  constructor(ruleId: string, version: string) {
    super(
      undefined,
      undefined,
      `Lifecycle rule '${ruleId}' version '${version}' received a conflicting payload for a known source event`,
      {
        extensions: {
          ruleId,
          version,
          retryable: false,
        },
      },
    );
  }
}

/** Reports invalid data supplied for a provider-neutral monetization signal. */
export class MonetizationSignalDefinitionProblem extends Problem {
  constructor(signalType: MonetizationSignalType, message: string) {
    super(
      "lifecycle-core/monetization-signal-invalid",
      ProblemCategory.ValidationError,
      `Monetization signal '${signalType}' is invalid: ${message}`,
      {
        extensions: {
          signalType,
          retryable: false,
        },
      },
    );
  }
}

/** Reports runtime capabilities required by a monetization recipe but not currently available. */
export class MonetizationRecipeCapabilityProblem extends Problem {
  constructor(recipeId: MonetizationRecipeId, missingCapabilities: readonly string[]) {
    super(
      "lifecycle-core/monetization-recipe-capability-missing",
      ProblemCategory.Conflict,
      `Monetization recipe '${recipeId}' requires unavailable capabilities: ${missingCapabilities.join(", ")}`,
      {
        extensions: {
          recipeId,
          missingCapabilities: [...missingCapabilities],
          retryable: false,
        },
      },
    );
  }
}

/** Reports a threshold-delivery claim that can no longer be acknowledged. */
export class MonetizationThresholdClaimProblem extends Problem {
  constructor(claimId: string) {
    super(
      "lifecycle-core/monetization-threshold-claim-unavailable",
      ProblemCategory.Conflict,
      `Monetization threshold claim '${claimId}' is missing or expired`,
      {
        extensions: {
          claimId,
          retryable: false,
        },
      },
    );
  }
}

export const MAX_WEBHOOK_TIMEOUT_MS = 2_147_483_647;

/** Webhook timeout configuration cannot be represented safely by a Node.js timer. */
export class InvalidWebhookTimeoutProblem extends Problem {
  readonly code = "lifecycle-core/webhook-timeout-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(timeoutMs: number) {
    super(
      undefined,
      undefined,
      `Webhook timeout must be an integer between 1 and ${MAX_WEBHOOK_TIMEOUT_MS} milliseconds; received ${String(timeoutMs)}`,
      {
        extensions: {
          timeoutMs: String(timeoutMs),
          retryable: false,
        },
      },
    );
  }
}
