import { Problem, ProblemCategory } from "@croco/problems-core";

export class SqsTaskConfigurationProblem extends Problem {
  readonly code = "tasks-sqs/invalid-configuration";
  readonly category = ProblemCategory.InternalServerError;

  constructor(field: string) {
    super(undefined, undefined, `Invalid SQS task configuration: ${field}`, {
      extensions: { field, retryable: false },
    });
  }
}

export class SqsTaskMessageProblem extends Problem {
  readonly code = "tasks-sqs/invalid-message";
  readonly category = ProblemCategory.BadRequest;

  constructor() {
    super(undefined, undefined, "Invalid or unauthorized SQS task message.", {
      extensions: { retryable: false },
    });
  }
}

export class SqsTaskPublishProblem extends Problem {
  readonly code = "tasks-sqs/publish-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    // SDK errors can contain credentials, endpoints and payloads. Acceptance may be unknown.
    super(undefined, undefined, "SQS task publication failed; inspect delivery before retrying.", {
      extensions: { provider: "sqs", outcome: "unknown", retryable: false },
    });
  }
}

export class SqsTaskHostProblem extends Problem {
  readonly code = "tasks-sqs/unsupported-host-event";
  readonly category = ProblemCategory.BadRequest;

  constructor() {
    super(undefined, undefined, "SQS consumption requires a Lambda SQS event source mapping.", {
      extensions: { retryable: false },
    });
  }
}
