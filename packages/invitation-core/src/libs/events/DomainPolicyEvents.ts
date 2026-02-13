import { DomainEvent } from '@croco/events-core';
import type { MembershipRole } from '@croco/membership-core';

export type DomainPolicyAddedEventData = {
  tenantId: string;
  domain: string;
  role: MembershipRole;
};

export class DomainPolicyAddedEvent extends DomainEvent {
  constructor(public readonly data: DomainPolicyAddedEventData) {
    super();
  }
}

export type DomainPolicyRemovedEventData = {
  tenantId: string;
  domain: string;
};

export class DomainPolicyRemovedEvent extends DomainEvent {
  constructor(public readonly data: DomainPolicyRemovedEventData) {
    super();
  }
}

export type DomainAutoJoinedEventData = {
  tenantId: string;
  userId: string;
  email: string;
  domain: string;
  role: MembershipRole;
};

export class DomainAutoJoinedEvent extends DomainEvent {
  constructor(public readonly data: DomainAutoJoinedEventData) {
    super();
  }
}
