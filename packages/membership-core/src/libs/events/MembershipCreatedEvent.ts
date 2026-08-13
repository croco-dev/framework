import { DomainEvent } from "@croco/events-core";
import type { MembershipRole } from "../types";

export type MembershipCreatedEventData = {
  tenantId: string;
  userId: string;
  role: MembershipRole;
};

export class MembershipCreatedEvent extends DomainEvent {
  constructor(
    public readonly data: MembershipCreatedEventData,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(eventId);
    if (occurredAt) {
      const event = this as unknown as { timestamp: Date };
      event.timestamp = new Date(occurredAt);
    }
  }
  static eventName = "membership.created";
}
