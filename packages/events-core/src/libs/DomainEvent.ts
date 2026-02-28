import { EventDefinitionProblem } from './problems/EventsProblems';

export type EventTraceContext = {
  traceId?: string;
  spanId?: string;
  traceFlags?: number;
  isValid?: boolean;
};

export type DomainEventMetadata = {
  [key: string]: unknown;
  traceContext?: EventTraceContext;
};

export abstract class DomainEvent {
  public static eventName?: string;

  public readonly eventName: string;
  public readonly timestamp: Date;
  public metadata: DomainEventMetadata;

  constructor() {
    const ctor = this.constructor as typeof DomainEvent & { eventName?: string };

    if (!ctor.eventName) {
      throw new EventDefinitionProblem();
    }

    this.eventName = ctor.eventName;
    this.timestamp = new Date();
    this.metadata = {};
  }
}
