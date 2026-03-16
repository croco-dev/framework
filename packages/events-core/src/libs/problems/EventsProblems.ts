import { Problem, ProblemCategory } from '@croco/problems-core';

export class EventBusNotSetProblem extends Problem {
  readonly code = 'events-core/event-bus-not-set';
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, 'EventBus has not been set. Call setEventBus() first.');
  }
}

export class EventDefinitionProblem extends Problem {
  readonly code = 'events-core/event-definition-error';
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, 'DomainEvent subclass must define static eventName');
  }
}

export class UnknownEventTypeProblem extends Problem {
  readonly code = 'events-core/unknown-event-type';
  readonly category = ProblemCategory.InternalServerError;
  constructor(eventType: string) {
    super(undefined, undefined, `Unknown event type: '${eventType}'`);
  }
}

export class EventDeserializationError extends Problem {
  readonly code = 'events-core/deserialization-error';
  readonly category = ProblemCategory.InternalServerError;
  constructor(eventName: string, reason: string) {
    super(undefined, undefined, `Cannot deserialize event '${eventName}': ${reason}`);
  }
}

export class DuplicateEventFieldProblem extends Problem {
  readonly code = 'events-core/duplicate-event-field';
  readonly category = ProblemCategory.InternalServerError;
  constructor(eventClassName: string, serializedKey: string) {
    super(
      undefined,
      undefined,
      `Duplicate event field mapping detected for '${eventClassName}' with serialized key '${serializedKey}'`
    );
  }
}

export class DuplicateEventNameProblem extends Problem {
  readonly code = 'events-core/duplicate-event-name';
  readonly category = ProblemCategory.InternalServerError;
  constructor(eventName: string) {
    super(undefined, undefined, `Duplicate event registration detected for eventName '${eventName}'`);
  }
}

export class EventTransactionContextUnavailableProblem extends Problem {
  readonly code = 'events-core/transaction-context-unavailable';
  readonly category = ProblemCategory.InternalServerError;
  constructor(reason: string) {
    super(undefined, undefined, `Transaction context unavailable during event publication: ${reason}`);
  }
}

export class EventAfterCommitRequiresActiveTransactionProblem extends Problem {
  readonly code = 'events-core/after-commit-requires-active-transaction';
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, 'publishAfterCommit requires an active transaction.');
  }
}
