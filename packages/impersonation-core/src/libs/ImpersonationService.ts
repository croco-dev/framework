import { ForbiddenProblem, hasPermission, UnauthorizedProblem } from "@croco/auth-core";
import { resolveImpersonationContext } from "@croco/audit-core";
import type { RequestContext } from "@croco/framework-context";
import { Component, Inject } from "@croco/framework-context";
import { IdPrefix } from "@croco/gid-core";
import {
  createImpersonationEndedEventIntent,
  createImpersonationStartedEventIntent,
} from "./eventIntent";
import type { ImpersonationLifecycleEventIntent } from "./eventIntent";
import { ImpersonationEndedEvent, ImpersonationStartedEvent } from "./events";
import {
  assertValidImpersonationConfig,
  invalidImpersonationDurationProblem,
} from "./ImpersonationConfig";
import {
  AuthProvider,
  ImpersonationLifecycleEventPublisher,
  ImpersonationStore,
} from "./interfaces";
import type { ImpersonationPrincipal } from "./interfaces";
import {
  ImpersonationIdentityConflictProblem,
  type ImpersonationLifecyclePublicationStage,
  ImpersonationLifecyclePublicationProblem,
  ImpersonationReasonRequiredProblem,
  ImpersonationSessionActorMismatchProblem,
  ImpersonationSessionNotFoundProblem,
  ImpersonationTargetNotFoundProblem,
  NestedImpersonationProblem,
  SelfImpersonationProblem,
} from "./problems/ImpersonationProblems";
import type { ImpersonationConfig, ImpersonationState } from "./types";
import { IMPERSONATION_CONFIG_TOKEN } from "./types";

export type ImpersonationContext = RequestContext & {
  impersonation: ImpersonationState;
};

export type ImpersonationLifecycleDiagnostic = {
  readonly code: "impersonation-core/lifecycle-event-pending";
  readonly eventId: string;
  readonly eventName: "impersonation.session.started" | "impersonation.session.ended";
  readonly lifecycle: ImpersonationLifecycleEventIntent["kind"];
  readonly occurredAt: string;
  readonly sessionId: string;
};

export type ImpersonationLifecycleDiagnostics = {
  readonly pendingEvents: readonly ImpersonationLifecycleDiagnostic[];
  readonly status: "healthy" | "reconciliation_required";
};

function resolveExpiration(now: Date, maxDurationMs: number): Date {
  const expiresAt = new Date(now.getTime() + maxDurationMs);
  if (Number.isNaN(expiresAt.getTime())) {
    throw invalidImpersonationDurationProblem(maxDurationMs);
  }
  return expiresAt;
}

@Component()
export class ImpersonationService {
  private readonly idPrefix = new IdPrefix("imp");

  constructor(
    @Inject(ImpersonationStore.token) private readonly store: ImpersonationStore,
    @Inject(AuthProvider.token) readonly _authProvider: AuthProvider,
    @Inject(IMPERSONATION_CONFIG_TOKEN) private readonly config: ImpersonationConfig,
    @Inject(ImpersonationLifecycleEventPublisher.token)
    private readonly eventPublisher: ImpersonationLifecycleEventPublisher,
  ) {
    assertValidImpersonationConfig(config);
  }

  private async resolveManager(context: RequestContext): Promise<ImpersonationPrincipal> {
    const principal = await this._authProvider.resolvePrincipal(context);
    if (!principal) {
      throw new UnauthorizedProblem();
    }

    if (context.user && context.user.id !== principal.id) {
      throw new ImpersonationIdentityConflictProblem();
    }

    if (!hasPermission([...principal.permissions], "impersonation:manage")) {
      throw new ForbiddenProblem("impersonation:manage");
    }

    return principal;
  }

  async start(
    context: RequestContext,
    targetUserId: string,
    reason?: string,
  ): Promise<ImpersonationState> {
    const principal = await this.resolveManager(context);

    if (principal.id === targetUserId) {
      throw new SelfImpersonationProblem();
    }

    if (!(await this._authProvider.targetExists(context, targetUserId))) {
      throw new ImpersonationTargetNotFoundProblem(targetUserId);
    }

    const normalizedReason = this.config.requireReason ? reason?.trim() : reason;
    if (this.config.requireReason && !normalizedReason) {
      throw new ImpersonationReasonRequiredProblem();
    }

    const now = new Date();
    const expiresAt = resolveExpiration(now, this.config.maxDurationMs);
    const sessionId = this.idPrefix.generate();

    const session: ImpersonationState = Object.freeze({
      sessionId,
      impersonatorId: principal.id,
      targetUserId,
      reason: normalizedReason,
      startedAt: now,
      expiresAt,
    });

    const intent = createImpersonationStartedEventIntent(session);
    if ((await this.store.commitStart(intent)) === "impersonator-active") {
      throw new NestedImpersonationProblem();
    }
    await this.publishEventIntent(intent);

    return session;
  }

  async end(context: RequestContext, sessionId: string): Promise<void> {
    const principal = await this.resolveManager(context);
    const session = await this.store.find(sessionId);
    if (!session) {
      throw new ImpersonationSessionNotFoundProblem(sessionId);
    }
    const intent = createImpersonationEndedEventIntent(session, new Date());
    const result = await this.store.commitEnd(intent, principal.id);
    if (result === "session-not-found") {
      throw new ImpersonationSessionNotFoundProblem(sessionId);
    }
    if (result === "actor-mismatch") {
      throw new ImpersonationSessionActorMismatchProblem();
    }
    if (result === "committed-start-pending") {
      throw this.publicationProblem(
        intent,
        "predecessor",
        new Error("Started lifecycle event must be published before the ended event"),
      );
    }
    await this.publishEventIntent(intent);
  }

  async publishPendingEvents(limit = 100): Promise<number> {
    const intents = await this.store.listPendingLifecycleEventIntents(limit);
    for (const intent of intents) {
      await this.publishEventIntent(intent);
    }
    return intents.length;
  }

  async getLifecycleDiagnostics(limit = 100): Promise<ImpersonationLifecycleDiagnostics> {
    const intents = await this.store.listPendingLifecycleEventIntents(limit);
    const pendingEvents = intents.map(
      (intent): ImpersonationLifecycleDiagnostic => ({
        code: "impersonation-core/lifecycle-event-pending",
        eventId: intent.eventId,
        eventName:
          intent.kind === "started"
            ? "impersonation.session.started"
            : "impersonation.session.ended",
        lifecycle: intent.kind,
        occurredAt: intent.occurredAt.toISOString(),
        sessionId: intent.session.sessionId,
      }),
    );
    return {
      pendingEvents,
      status: pendingEvents.length === 0 ? "healthy" : "reconciliation_required",
    };
  }

  isImpersonating(context: RequestContext): context is ImpersonationContext {
    return resolveImpersonationContext(context).status === "active";
  }

  getImpersonator(context: RequestContext): string | null {
    const impersonation = resolveImpersonationContext(context);
    return impersonation.status === "active" ? impersonation.state.impersonatorId : null;
  }

  getTargetUser(context: RequestContext): string | null {
    const impersonation = resolveImpersonationContext(context);
    return impersonation.status === "active" ? impersonation.state.targetUserId : null;
  }

  private async publishEventIntent(intent: ImpersonationLifecycleEventIntent): Promise<void> {
    try {
      await this.eventPublisher.publishIdempotently(this.restoreEvent(intent));
    } catch (error) {
      throw this.publicationProblem(intent, "publish", error);
    }

    try {
      await this.store.markLifecycleEventPublished(intent.eventId);
    } catch (error) {
      throw this.publicationProblem(intent, "acknowledge", error);
    }
  }

  private restoreEvent(
    intent: ImpersonationLifecycleEventIntent,
  ): ImpersonationStartedEvent | ImpersonationEndedEvent {
    return intent.kind === "started"
      ? new ImpersonationStartedEvent(intent.session, intent.eventId, intent.occurredAt)
      : new ImpersonationEndedEvent(intent.session, intent.eventId, intent.occurredAt);
  }

  private publicationProblem(
    intent: ImpersonationLifecycleEventIntent,
    stage: ImpersonationLifecyclePublicationStage,
    error: unknown,
  ): ImpersonationLifecyclePublicationProblem {
    return new ImpersonationLifecyclePublicationProblem(
      intent.session.sessionId,
      intent.eventId,
      intent.kind,
      stage,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
