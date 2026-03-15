import type { RequestContext } from '@croco/framework-context';
import { Component, Inject } from '@croco/framework-context';
import { IdPrefix } from '@croco/gid-core';
import { AuthProvider, ImpersonationStore } from './interfaces';
import type { ImpersonationConfig, ImpersonationContext, ImpersonationState } from './types';
import { IMPERSONATION_CONFIG_TOKEN } from './types';

// TODO: TASK 20 - Problem 클래스 구현 필요
// throw new SelfImpersonationProblem();
// throw new NestedImpersonationProblem();
// throw new ImpersonationReasonRequiredProblem();
// throw new ImpersonationSessionNotFoundProblem();

// TODO: TASK 21 - Event 클래스 구현 필요
// const event = new ImpersonationStartedEvent({ ... });
// await this.eventPublisher.publish(event);

@Component()
export class ImpersonationService {
  private readonly idPrefix = new IdPrefix('imp');

  constructor(
    @Inject(ImpersonationStore.token) private readonly store: ImpersonationStore,
    @Inject(AuthProvider.token) private readonly authProvider: AuthProvider,
    @Inject(IMPERSONATION_CONFIG_TOKEN) private readonly config: ImpersonationConfig
  ) {}

  async start(impersonatorId: string, targetUserId: string, reason?: string): Promise<ImpersonationState> {
    if (impersonatorId === targetUserId) {
      // TODO: TASK 20 - Problem 클래스 구현 필요
      // throw new SelfImpersonationProblem();
      throw new Error('Self impersonation is not allowed');
    }

    const existing = await this.store.findByImpersonator(impersonatorId);
    if (existing) {
      // TODO: TASK 20 - Problem 클래스 구현 필요
      // throw new NestedImpersonationProblem();
      throw new Error('Nested impersonation is not allowed');
    }

    if (this.config.requireReason && !reason) {
      // TODO: TASK 20 - Problem 클래스 구현 필요
      // throw new ImpersonationReasonRequiredProblem();
      throw new Error('Reason is required for impersonation');
    }

    const sessionId = this.idPrefix.generate();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.maxDurationMs);

    const session: ImpersonationState = {
      sessionId,
      impersonatorId,
      targetUserId,
      reason,
      startedAt: now,
      expiresAt,
    };

    await this.store.save(session);

    // TODO: TASK 21 - Event 클래스 구현 필요
    // const event = new ImpersonationStartedEvent({
    //   sessionId,
    //   impersonatorId,
    //   targetUserId,
    //   reason,
    //   startedAt: now,
    // });
    // await this.eventPublisher.publish(event);

    return session;
  }

  async end(sessionId: string): Promise<void> {
    const session = await this.store.find(sessionId);
    if (!session) {
      // TODO: TASK 20 - Problem 클래스 구현 필요
      // throw new ImpersonationSessionNotFoundProblem(sessionId);
      throw new Error(`Impersonation session not found: ${sessionId}`);
    }

    await this.store.revoke(sessionId);

    // TODO: TASK 21 - Event 클래스 구현 필요
    // const event = new ImpersonationEndedEvent({
    //   sessionId,
    //   impersonatorId: session.impersonatorId,
    //   targetUserId: session.targetUserId,
    //   endedAt: new Date(),
    // });
    // await this.eventPublisher.publish(event);
  }

  isImpersonating(context: RequestContext): context is ImpersonationContext {
    return 'impersonation' in context;
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
