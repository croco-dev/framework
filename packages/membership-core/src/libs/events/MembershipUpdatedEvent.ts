import { DomainEvent } from "@croco/events-core";
import type { MembershipRole } from "../types";

export type MembershipUpdatedEventData = {
  tenantId: string;
  userId: string;
  oldRole: MembershipRole;
  newRole: MembershipRole;
};

export class MembershipUpdatedEvent extends DomainEvent {
  static eventName = "membership.updated";

  constructor(
    public readonly data: MembershipUpdatedEventData,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(eventId);
    if (occurredAt) {
      const event = this as unknown as { timestamp: Date };
      event.timestamp = new Date(occurredAt);
    }
  }
}
