import { DomainEvent, restoreSerializedEventIdentity } from "@croco/events-core";
import type { ImpersonationState } from "./types";

export class ImpersonationStartedEvent extends DomainEvent {
  static eventName = "impersonation.session.started";

  constructor(
    public readonly session: ImpersonationState,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(eventId);
    if (occurredAt) {
      restoreSerializedEventIdentity(this, this.eventId, occurredAt.toISOString());
    }
  }
}

export class ImpersonationEndedEvent extends DomainEvent {
  static eventName = "impersonation.session.ended";

  constructor(
    public readonly session: ImpersonationState,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(eventId);
    if (occurredAt) {
      restoreSerializedEventIdentity(this, this.eventId, occurredAt.toISOString());
    }
  }
}
