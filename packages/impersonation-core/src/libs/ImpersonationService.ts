import { ForbiddenProblem, hasPermission, UnauthorizedProblem } from "@croco/auth-core";
import { EventBusConfig, EventPublisher } from "@croco/events-core";
import type { RequestContext } from "@croco/framework-context";
import { Component, Inject } from "@croco/framework-context";
import { IdPrefix } from "@croco/gid-core";
import { ImpersonationEndedEvent, ImpersonationStartedEvent } from "./events";
import { AuthProvider, ImpersonationStore } from "./interfaces";
import {
  ImpersonationIdentityConflictProblem,
  ImpersonationReasonRequiredProblem,
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

@Component()
export class ImpersonationService {
  private readonly idPrefix = new IdPrefix("imp");
  private readonly eventPublisher = new EventPublisher(EventBusConfig.getInstance());

  constructor(
    @Inject(ImpersonationStore.token) private readonly store: ImpersonationStore,
    @Inject(AuthProvider.token) readonly _authProvider: AuthProvider,
    @Inject(IMPERSONATION_CONFIG_TOKEN) private readonly config: ImpersonationConfig,
  ) {}

  async start(
    context: RequestContext,
    targetUserId: string,
    reason?: string,
  ): Promise<ImpersonationState> {
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

    if (principal.id === targetUserId) {
      throw new SelfImpersonationProblem();
    }

    if (!(await this._authProvider.targetExists(context, targetUserId))) {
      throw new ImpersonationTargetNotFoundProblem(targetUserId);
    }

    const existing = await this.store.findByImpersonator(principal.id);
    if (existing) {
      throw new NestedImpersonationProblem();
    }

    if (this.config.requireReason && !reason) {
      throw new ImpersonationReasonRequiredProblem();
    }

    const sessionId = this.idPrefix.generate();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.maxDurationMs);

    const session: ImpersonationState = Object.freeze({
      sessionId,
      impersonatorId: principal.id,
      targetUserId,
      reason,
      startedAt: now,
      expiresAt,
    });

    await this.store.save(session);

    await this.eventPublisher.publishNow(new ImpersonationStartedEvent(session));

    return session;
  }

  async end(sessionId: string): Promise<void> {
    const session = await this.store.find(sessionId);
    if (!session) {
      throw new ImpersonationSessionNotFoundProblem(sessionId);
    }

    await this.store.revoke(sessionId);

    await this.eventPublisher.publishNow(new ImpersonationEndedEvent(session));
  }

  isImpersonating(context: RequestContext): context is ImpersonationContext {
    return "impersonation" in context;
  }

  getImpersonator(context: RequestContext): string | null {
    if (this.isImpersonating(context)) {
      return context.impersonation.impersonatorId;
    }
    return null;
  }

  getTargetUser(context: RequestContext): string | null {
    if (this.isImpersonating(context)) {
      return context.impersonation.targetUserId;
    }
    return null;
  }
}
