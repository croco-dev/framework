import { DomainEvent } from '@croco/events-core';
import type { MembershipRole } from '../types';

export type MembershipCreatedEventData = {
  tenantId: string;
  userId: string;
  role: MembershipRole;
};

export class MembershipCreatedEvent extends DomainEvent {
  constructor(public readonly data: MembershipCreatedEventData) {
    super();
  }
  static eventName = 'membership.created';
}
