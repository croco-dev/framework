import { Problem, ProblemCategory } from '@croco/problems-core';

export class GraphQLResolversNotConfiguredProblem extends Problem {
  constructor() {
    super(
      'transports-graphql/resolvers-not-configured',
      ProblemCategory.InternalServerError,
      'No resolvers provided. Provide resolvers manually or enable autoDiscover.'
    );
  }
}

export class GraphQLSchemaNotConfiguredProblem extends Problem {
  constructor() {
    super(
      'transports-graphql/schema-not-configured',
      ProblemCategory.InternalServerError,
      'No schema provided. Provide either schema or schemaOptions.'
    );
  }
}

export class GraphQLServerNotInitializedProblem extends Problem {
  constructor(detail = 'Server not initialized. Call initialize() first.') {
    super('transports-graphql/server-not-initialized', ProblemCategory.InternalServerError, detail);
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
  constructor() {
    super('transports-graphql/request-body-aborted', ProblemCategory.BadRequest, 'Request body aborted');
  }
}
