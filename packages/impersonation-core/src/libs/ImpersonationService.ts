import { ForbiddenProblem, hasPermission, UnauthorizedProblem } from "@croco/auth-core";
import { resolveImpersonationContext } from "@croco/audit-core";
import { EventBusConfig, EventPublisher } from "@croco/events-core";
import type { RequestContext } from "@croco/framework-context";
import { Component, Inject } from "@croco/framework-context";
import { IdPrefix } from "@croco/gid-core";
import { ImpersonationEndedEvent, ImpersonationStartedEvent } from "./events";
import {
  assertValidImpersonationConfig,
  invalidImpersonationDurationProblem,
} from "./ImpersonationConfig";
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
  private readonly eventPublisher = new EventPublisher(EventBusConfig.getInstance());

  constructor(
    @Inject(ImpersonationStore.token) private readonly store: ImpersonationStore,
    @Inject(AuthProvider.token) readonly _authProvider: AuthProvider,
    @Inject(IMPERSONATION_CONFIG_TOKEN) private readonly config: ImpersonationConfig,
  ) {
    assertValidImpersonationConfig(config);
  }

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

    const createResult = await this.store.createIfNoActiveSession(session);
    if (createResult.status === "active-session-exists") {
      throw new NestedImpersonationProblem();
    }

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
}
