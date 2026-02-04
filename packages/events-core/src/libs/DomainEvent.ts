import type { TraceInfo } from '@croco/telemetry-api';

export type DomainEventMetadata = {
  traceContext?: TraceInfo;
};

export abstract class DomainEvent {
  public readonly eventName: string;
  public readonly timestamp: Date;
  public metadata: DomainEventMetadata;

  constructor() {
    this.eventName = this.constructor.name;
    this.timestamp = new Date();
    this.metadata = {};
  }
}
