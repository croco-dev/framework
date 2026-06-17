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
