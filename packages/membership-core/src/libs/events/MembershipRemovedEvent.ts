import { DomainEvent } from "@croco/events-core";
import type { MembershipRole } from "../types";

export type MembershipRemovedEventData = {
  tenantId: string;
  userId: string;
  role: MembershipRole;
};

export class MembershipRemovedEvent extends DomainEvent {
  constructor(
    public readonly data: MembershipRemovedEventData,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(eventId);
    if (occurredAt) {
      const event = this as unknown as { timestamp: Date };
      event.timestamp = new Date(occurredAt);
    }
  }
  static eventName = "membership.removed";
}
