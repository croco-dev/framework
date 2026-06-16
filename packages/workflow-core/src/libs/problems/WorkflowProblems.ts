import { Problem, ProblemCategory } from "@croco/problems-core";

export class WorkflowNotFoundProblem extends Problem {
  readonly code = "workflow-core/workflow-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(workflowName: string) {
    super(undefined, undefined, `Workflow not found: '${workflowName}'`);
  }
}

export class DuplicateWorkflowRegistrationProblem extends Problem {
  constructor(workflowName: string) {
    super(
      "workflow-core/duplicate-workflow-registration",
      ProblemCategory.InternalServerError,
      `Workflow ${workflowName} is already registered`,
      {
        extensions: {
          workflowName,
          retryable: false,
        },
      },
    );
  }
}

export class WorkflowDefinitionProblem extends Problem {
  constructor(workflowName: string, message: string) {
    super(
      "workflow-core/workflow-definition-invalid",
      ProblemCategory.InternalServerError,
      `Workflow '${workflowName}' is invalid: ${message}`,
      {
        extensions: {
          workflowName,
          retryable: false,
        },
      },
    );
  }
}

export class WorkflowReplayUnsupportedProblem extends Problem {
  constructor() {
    super(
      "workflow-core/replay-unsupported",
      ProblemCategory.InternalServerError,
      "Execution manager does not support workflow replay",
      {
        extensions: {
          retryable: false,
        },
      },
    );
  }
}
