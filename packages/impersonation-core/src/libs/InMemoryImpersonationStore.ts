import { Component } from "@croco/framework-context";
import { cloneImpersonationLifecycleEventIntent, cloneImpersonationState } from "./eventIntent";
import type {
  ImpersonationEndedEventIntent,
  ImpersonationLifecycleEventIntent,
  ImpersonationStartedEventIntent,
} from "./eventIntent";
import { ImpersonationStore } from "./interfaces";
import {
  ImpersonationEventIntentConflictProblem,
  InvalidImpersonationEventIntentLimitProblem,
} from "./problems/ImpersonationProblems";
import type { ImpersonationState } from "./types";

@Component()
export class InMemoryImpersonationStore extends ImpersonationStore {
  private readonly sessions = new Map<string, ImpersonationState>();
  private readonly activeSessionsByImpersonator = new Map<string, ImpersonationState>();
  private readonly eventIntents = new Map<string, ImpersonationLifecycleEventIntent>();
  private readonly seenSessionIds = new Set<string>();

  async commitStart(
    intent: ImpersonationStartedEventIntent,
  ): Promise<"committed" | "impersonator-active"> {
    if (intent.eventId !== `impersonation.session.started:${intent.session.sessionId}`) {
      throw new ImpersonationEventIntentConflictProblem(intent.eventId);
    }
    if (this.seenSessionIds.has(intent.session.sessionId)) {
      throw new ImpersonationEventIntentConflictProblem(intent.eventId);
    }

    const existing = this.activeSessionsByImpersonator.get(intent.session.impersonatorId);
    if (existing && !this.isExpired(existing)) {
      return "impersonator-active";
    }
    if (existing) {
      this.deleteSession(existing);
    }

    const session = cloneImpersonationState(intent.session);
    this.seenSessionIds.add(session.sessionId);
    this.sessions.set(session.sessionId, session);
    this.activeSessionsByImpersonator.set(session.impersonatorId, session);
    this.eventIntents.set(intent.eventId, cloneImpersonationLifecycleEventIntent(intent));
    return "committed";
  }

  async commitEnd(
    intent: ImpersonationEndedEventIntent,
    impersonatorId: string,
  ): Promise<"actor-mismatch" | "committed" | "committed-start-pending" | "session-not-found"> {
    const session = this.findActive(intent.session.sessionId);
    if (!session) return "session-not-found";
    if (session.impersonatorId !== impersonatorId) return "actor-mismatch";
    if (
      intent.eventId !== `impersonation.session.ended:${intent.session.sessionId}` ||
      !sameSession(session, intent.session)
    ) {
      throw new ImpersonationEventIntentConflictProblem(intent.eventId);
    }

    this.deleteSession(session);
    this.eventIntents.set(intent.eventId, cloneImpersonationLifecycleEventIntent(intent));
    return this.eventIntents.has(`impersonation.session.started:${intent.session.sessionId}`)
      ? "committed-start-pending"
      : "committed";
  }

  async find(sessionId: string): Promise<ImpersonationState | null> {
    return this.findActive(sessionId);
  }

  async findByImpersonator(impersonatorId: string): Promise<ImpersonationState | null> {
    const session = this.activeSessionsByImpersonator.get(impersonatorId);
    if (!session) return null;
    if (this.isExpired(session)) {
      this.deleteSession(session);
      return null;
    }
    return cloneImpersonationState(session);
  }

  async listPendingLifecycleEventIntents(
    limit = 100,
  ): Promise<readonly ImpersonationLifecycleEventIntent[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new InvalidImpersonationEventIntentLimitProblem(limit);
    }
    return [...this.eventIntents.values()]
      .sort(compareLifecycleEventIntents)
      .slice(0, limit)
      .map(cloneImpersonationLifecycleEventIntent);
  }

  async markLifecycleEventPublished(eventId: string): Promise<void> {
    this.eventIntents.delete(eventId);
  }

  private findActive(sessionId: string): ImpersonationState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (this.isExpired(session)) {
      this.deleteSession(session);
      return null;
    }
    return cloneImpersonationState(session);
  }

  private isExpired(session: ImpersonationState): boolean {
    return session.expiresAt.getTime() <= Date.now();
  }

  private deleteSession(session: ImpersonationState): void {
    this.sessions.delete(session.sessionId);
    const active = this.activeSessionsByImpersonator.get(session.impersonatorId);
    if (active?.sessionId === session.sessionId) {
      this.activeSessionsByImpersonator.delete(session.impersonatorId);
    }
  }
}

function compareLifecycleEventIntents(
  left: ImpersonationLifecycleEventIntent,
  right: ImpersonationLifecycleEventIntent,
): number {
  return (
    lifecycleEventOrderTime(left) - lifecycleEventOrderTime(right) ||
    lifecycleEventRank(left) - lifecycleEventRank(right) ||
    left.eventId.localeCompare(right.eventId)
  );
}

function lifecycleEventOrderTime(intent: ImpersonationLifecycleEventIntent): number {
  return Math.max(intent.occurredAt.getTime(), intent.session.startedAt.getTime());
}

function lifecycleEventRank(intent: ImpersonationLifecycleEventIntent): number {
  return intent.kind === "started" ? 0 : 1;
}

function sameSession(left: ImpersonationState, right: ImpersonationState): boolean {
  return (
    left.sessionId === right.sessionId &&
    left.impersonatorId === right.impersonatorId &&
    left.targetUserId === right.targetUserId &&
    left.reason === right.reason &&
    left.startedAt.getTime() === right.startedAt.getTime() &&
    left.expiresAt.getTime() === right.expiresAt.getTime()
  );
}
