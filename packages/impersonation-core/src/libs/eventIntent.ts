import type { ImpersonationState } from "./types";

export type ImpersonationStartedEventIntent = {
  readonly kind: "started";
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly session: ImpersonationState;
};

export type ImpersonationEndedEventIntent = {
  readonly kind: "ended";
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly session: ImpersonationState;
};

export type ImpersonationLifecycleEventIntent =
  | ImpersonationStartedEventIntent
  | ImpersonationEndedEventIntent;

export function createImpersonationStartedEventIntent(
  session: ImpersonationState,
): ImpersonationStartedEventIntent {
  return {
    kind: "started",
    eventId: `impersonation.session.started:${session.sessionId}`,
    occurredAt: new Date(session.startedAt),
    session: cloneImpersonationState(session),
  };
}

export function createImpersonationEndedEventIntent(
  session: ImpersonationState,
  occurredAt: Date,
): ImpersonationEndedEventIntent {
  return {
    kind: "ended",
    eventId: `impersonation.session.ended:${session.sessionId}`,
    occurredAt: new Date(occurredAt),
    session: cloneImpersonationState(session),
  };
}

export function cloneImpersonationLifecycleEventIntent(
  intent: ImpersonationLifecycleEventIntent,
): ImpersonationLifecycleEventIntent {
  return {
    ...intent,
    occurredAt: new Date(intent.occurredAt),
    session: cloneImpersonationState(intent.session),
  };
}

export function cloneImpersonationState(session: ImpersonationState): ImpersonationState {
  return Object.freeze({
    ...session,
    startedAt: new Date(session.startedAt),
    expiresAt: new Date(session.expiresAt),
  });
}
