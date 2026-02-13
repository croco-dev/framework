import { DomainEvent } from '@croco/events-core';
import type { MembershipRole } from '@croco/membership-core';
import type { InvitationType } from '../types';

export type InvitationCreatedEventData = {
  invitationId: string;
  tenantId: string;
  inviterId: string;
  email: string | null;
  role: MembershipRole;
  type: InvitationType;
  expiresAt: Date;
};

export type InvitationAcceptedEventData = {
  invitationId: string;
  tenantId: string;
  userId: string;
  email: string | null;
  role: MembershipRole;
  type: InvitationType;
};

export type InvitationRevokedEventData = {
  invitationId: string;
  tenantId: string;
  email: string | null;
  role: MembershipRole;
  type: InvitationType;
};

export type InvitationDeclinedEventData = {
  invitationId: string;
  tenantId: string;
  email: string | null;
  role: MembershipRole;
  type: InvitationType;
};

export class InvitationCreatedEvent extends DomainEvent {
  constructor(public readonly data: InvitationCreatedEventData) {
    super();
  }
}

export class InvitationAcceptedEvent extends DomainEvent {
  constructor(public readonly data: InvitationAcceptedEventData) {
    super();
  }
}

export class InvitationRevokedEvent extends DomainEvent {
  constructor(public readonly data: InvitationRevokedEventData) {
    super();
  }
}

export class InvitationDeclinedEvent extends DomainEvent {
  constructor(public readonly data: InvitationDeclinedEventData) {
    super();
  }
}
