import { Problem, ProblemCategory } from '@croco/problems-core';

export class GraphQLResolversNotConfiguredProblem extends Problem {
  readonly code = 'transports-graphql/resolvers-not-configured';
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super('No resolvers provided. Provide resolvers manually or enable autoDiscover.');
  }
}

export class GraphQLSchemaNotConfiguredProblem extends Problem {
  readonly code = 'transports-graphql/schema-not-configured';
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super('No schema provided. Provide either schema or schemaOptions.');
  }
}

export class GraphQLServerNotInitializedProblem extends Problem {
  readonly code = 'transports-graphql/server-not-initialized';
  readonly category = ProblemCategory.InternalServerError;
  constructor(detail = 'Server not initialized. Call initialize() first.') {
    super(detail);
  }
}

export class GraphQLRequestBodyTooLargeProblem extends Problem {
  constructor(maxBodySizeBytes: number) {
    super(
      'transports-graphql/request-body-too-large',
      ProblemCategory.BadRequest,
      `Payload Too Large (max ${maxBodySizeBytes} bytes)`,
      {
        extensions: {
          maxBodySizeBytes,
        },
      }
    );
  }

  get status(): number {
    return 413;
  }

  get title(): string {
    return 'Payload Too Large';
  }
}

export class GraphQLRequestBodyAbortedProblem extends Problem {
  readonly code = 'transports-graphql/request-body-aborted';
  readonly category = ProblemCategory.BadRequest;
  constructor() {
    super('Request body aborted');
  }
}
