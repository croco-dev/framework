import { Problem, ProblemCategory } from "@croco/problems-core";

const PROBLEM_TYPE_BASE = "https://croco.dev/problems/transports-graphql";

/** The configured request body boundary cannot be enforced safely. */
export class GraphQLBodyLimitConfigurationProblem extends Problem {
  constructor() {
    super(
      "transports-graphql/body-limit-invalid-configuration",
      ProblemCategory.InternalServerError,
      "maxBodySizeBytes must be a finite positive safe integer",
      {
        type: `${PROBLEM_TYPE_BASE}/body-limit-invalid-configuration`,
      },
    );
  }
}

export class GraphQLResolversNotConfiguredProblem extends Problem {
  readonly code = "transports-graphql/resolvers-not-configured";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(
      undefined,
      undefined,
      "No resolvers provided. Provide resolvers manually or enable autoDiscover.",
    );
  }
}

export class GraphQLSchemaNotConfiguredProblem extends Problem {
  readonly code = "transports-graphql/schema-not-configured";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, "No schema provided. Provide either schema or schemaOptions.");
  }
}

export class GraphQLServerNotInitializedProblem extends Problem {
  readonly code = "transports-graphql/server-not-initialized";
  readonly category = ProblemCategory.InternalServerError;
  constructor(detail = "Server not initialized. Call initialize() first.") {
    super(detail);
  }
}

export class GraphQLRequestBodyTooLargeProblem extends Problem {
  constructor(maxBodySizeBytes: number) {
    super(
      "transports-graphql/request-body-too-large",
      ProblemCategory.PayloadTooLarge,
      `Payload Too Large (max ${maxBodySizeBytes} bytes)`,
      {
        extensions: {
          maxBodySizeBytes,
        },
      },
    );
  }
}

export class GraphQLRequestBodyAbortedProblem extends Problem {
  readonly code = "transports-graphql/request-body-aborted";
  readonly category = ProblemCategory.BadRequest;
  constructor() {
    super(undefined, undefined, "Request body aborted");
  }
}

export class GraphQLRequestHandlingFailedProblem extends Problem {
  readonly code = "transports-graphql/request-handling-failed";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, "An internal error occurred");
  }
}
