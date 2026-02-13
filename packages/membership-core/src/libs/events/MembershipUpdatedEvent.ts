import { DomainEvent } from '@croco/events-core';
import type { MembershipRole } from '../types';

export type MembershipUpdatedEventData = {
  tenantId: string;
  userId: string;
  oldRole: MembershipRole;
  newRole: MembershipRole;
};

export class MembershipUpdatedEvent extends DomainEvent {
  constructor(public readonly data: MembershipUpdatedEventData) {
    super();
  }
}
