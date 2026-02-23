import type { TraceInfo } from '@croco/telemetry-api';

export type DomainEventMetadata = {
  [key: string]: unknown;
  traceContext?: TraceInfo;
};

export abstract class DomainEvent {
  public static eventName?: string;

  public readonly eventName: string;
  public readonly timestamp: Date;
  public metadata: DomainEventMetadata;

  constructor() {
    const ctor = this.constructor as typeof DomainEvent & { eventName?: string };

    if (!ctor.eventName) {
      throw new Error('DomainEvent subclass must define static eventName');
    }

    this.eventName = ctor.eventName;
    this.timestamp = new Date();
    this.metadata = {};
  }
}
