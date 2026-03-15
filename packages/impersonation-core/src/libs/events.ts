import { DomainEvent } from '@croco/events-core';
import type { ImpersonationState } from './types';

export class ImpersonationStartedEvent extends DomainEvent {
  static eventName = 'impersonation.session.started';

  constructor(public readonly session: ImpersonationState) {
    super();
  }
}

export class ImpersonationEndedEvent extends DomainEvent {
  static eventName = 'impersonation.session.ended';

  constructor(public readonly session: ImpersonationState) {
    super();
  }
}
