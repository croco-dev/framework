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
  InvalidImpersonationConfigurationProblem,
  NestedImpersonationProblem,
  SelfImpersonationProblem,
} from "./problems/ImpersonationProblems";
import type { ImpersonationConfig, ImpersonationState } from "./types";
import { IMPERSONATION_CONFIG_TOKEN } from "./types";

export type ImpersonationContext = RequestContext & {
  impersonation: ImpersonationState;
};

const MAX_DATE_TIMESTAMP_MS = 8_640_000_000_000_000;

function toConfigurationReceivedValue(value: unknown): number | string {
  if (typeof value !== "number") {
    return `non-number-${typeof value}`;
  }
  if (Number.isFinite(value)) {
    return value;
  }
  if (Number.isNaN(value)) {
    return "NaN";
  }
  return value === Number.POSITIVE_INFINITY ? "Infinity" : "-Infinity";
}

function invalidDurationProblem(value: unknown): InvalidImpersonationConfigurationProblem {
  return new InvalidImpersonationConfigurationProblem({
    field: "maxDurationMs",
    constraint: "positive-safe-integer-with-representable-expiration",
    receivedValue: toConfigurationReceivedValue(value),
  });
}

function resolveExpiration(now: Date, maxDurationMs: number): Date {
  const expiresAt = new Date(now.getTime() + maxDurationMs);
  if (Number.isNaN(expiresAt.getTime())) {
    throw invalidDurationProblem(maxDurationMs);
  }
  return expiresAt;
}

function assertValidImpersonationConfig(config: ImpersonationConfig): void {
  if (
    !Number.isSafeInteger(config.maxDurationMs) ||
    config.maxDurationMs <= 0 ||
    config.maxDurationMs > MAX_DATE_TIMESTAMP_MS - Date.now()
  ) {
    throw invalidDurationProblem(config.maxDurationMs);
  }

  if (!Array.isArray(config.blockedActions)) {
    throw new InvalidImpersonationConfigurationProblem({
      field: "blockedActions",
      constraint: "array-of-non-blank-strings",
      receivedValue: "non-array",
    });
  }

  const invalidActionIndex = config.blockedActions.findIndex(
    (action) => typeof action !== "string" || action.trim().length === 0,
  );
  if (invalidActionIndex !== -1) {
    throw new InvalidImpersonationConfigurationProblem({
      field: "blockedActions",
      constraint: "array-of-non-blank-strings",
      receivedValue: `invalid-item-at-index-${invalidActionIndex}`,
    });
  }
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
