import { Problem, ProblemCategory } from '@croco/problems-core';

export class EventBusNotSetProblem extends Problem {
  constructor() {
    super(
      'events-core/event-bus-not-set',
      ProblemCategory.InternalServerError,
      'EventBus has not been set. Call setEventBus() first.'
    );
  }
}

export class EventDefinitionProblem extends Problem {
  constructor() {
    super(
      'events-core/event-definition-error',
      ProblemCategory.InternalServerError,
      'DomainEvent subclass must define static eventName'
    );
  }
}

export class UnknownEventTypeProblem extends Problem {
  constructor(eventType: string) {
    super('events-core/unknown-event-type', ProblemCategory.InternalServerError, `Unknown event type: '${eventType}'`);
  }
}
