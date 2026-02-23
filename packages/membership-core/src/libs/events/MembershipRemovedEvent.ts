import { DomainEvent } from '@croco/events-core';
import type { MembershipRole } from '../types';

export type MembershipRemovedEventData = {
  tenantId: string;
  userId: string;
  role: MembershipRole;
};

export class MembershipRemovedEvent extends DomainEvent {
  constructor(public readonly data: MembershipRemovedEventData) {
    super();
  }
  static eventName = 'membership.removed';
}
