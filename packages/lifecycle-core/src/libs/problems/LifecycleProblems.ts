import { Problem, ProblemCategory } from "@croco/problems-core";

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
