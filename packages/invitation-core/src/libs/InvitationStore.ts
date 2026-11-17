import { InvalidInvitationExpiryDurationProblem } from "./problems/InvitationProblems";
import {
  DuplicateInvitationProblem,
  InvitationRateLimitExceededProblem,
  InvitationRateLimitUnavailableProblem,
} from "./problems/RateLimitProblems";
import type {
  EmailInvitationCreation,
  EmailInvitationCreationInput,
  Invitation,
  InvitationStatus,
  RateLimitConfig,
} from "./types";

export type InvitationStatusTransitionMeta = {
  acceptedAt?: Date;
  rejectedAt?: Date;
  revokedAt?: Date;
};

export abstract class InvitationStore {
  /** Clock used to compare this store's persisted timestamps. */
  currentTime?(): Promise<Date>;

  abstract findById(id: string): Promise<Invitation | null>;
  abstract findByTokenHash(tokenHash: string): Promise<Invitation | null>;
  abstract findByTenantAndEmail(tenantId: string, email: string): Promise<Invitation | null>;
  abstract findAllByTenant(tenantId: string): Promise<Invitation[]>;
  abstract save(invitation: Invitation): Promise<Invitation>;
  abstract createEmailInvitation(
    input: EmailInvitationCreationInput,
  ): Promise<EmailInvitationCreation>;
  /**
   * Validate the fingerprint and replay an unexpired creation for the same tenant and key first.
   * For a new creation, check both quota windows and reject any live pending invitation for the
   * same normalized email. Check and persist atomically using the store's admission time
   * for the quota cutoff, issuance timestamp and calendar-day lifetime.
   */
  createRateLimitedInvitation?(
    input: EmailInvitationCreationInput,
    config: RateLimitConfig,
    expiresInDays: number,
  ): Promise<EmailInvitationCreation>;

  /** Inspect current usage without reserving capacity. */
  static async checkIssuanceRateLimit(
    store: InvitationStore,
    tenantId: string,
    config: RateLimitConfig,
    now?: number,
  ): Promise<void> {
    const cutoff = now ?? (await InvitationStore.currentTimeMillis(store));
    for (const window of InvitationStore.issuanceWindows(config, cutoff)) {
      window.assertAvailable(await store.countIssuedByTenant(tenantId, window.since));
    }
  }

  static async currentTimeMillis(store: InvitationStore): Promise<number> {
    return store.currentTime ? (await store.currentTime()).getTime() : Date.now();
  }

  static assertRateLimitConfig(config: RateLimitConfig): void {
    if (
      typeof config?.maxInvitesPerHour !== "number" ||
      typeof config?.maxInvitesPerDay !== "number" ||
      Number.isNaN(config.maxInvitesPerHour) ||
      Number.isNaN(config.maxInvitesPerDay)
    ) {
      throw new InvitationRateLimitUnavailableProblem("invalid-rate-limit-policy");
    }
  }

  abstract findEmailInvitationCreation(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<EmailInvitationCreation | null>;
  /** When given an invitation ID, claim only that creation. */
  abstract claimEmailInvitationNotification(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
    claimExpiresAt: Date,
    expectedInvitationId?: string,
  ): Promise<EmailInvitationCreation | null>;
  /** When given an invitation ID, claim only that creation. */
  abstract claimEmailInvitationEvent(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
    claimExpiresAt: Date,
    expectedInvitationId?: string,
  ): Promise<EmailInvitationCreation | null>;
  abstract completeEmailInvitationNotification(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<EmailInvitationCreation | null>;
  abstract completeEmailInvitationEvent(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<EmailInvitationCreation | null>;
  abstract releaseEmailInvitationNotification(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<void>;
  abstract releaseEmailInvitationEvent(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<void>;
  /** Activate only a creating invitation whose ID matches the supplied expectation. Preserve other statuses. */
  abstract activateEmailInvitation(
    tenantId: string,
    idempotencyKey: string,
    expectedInvitationId?: string,
  ): Promise<EmailInvitationCreation | null>;
  abstract deleteExpiredEmailInvitationCreations(now: Date): Promise<number>;
  abstract updateStatus(
    tenantId: string,
    id: string,
    status: InvitationStatus,
  ): Promise<Invitation | null>;
  abstract compareAndSetStatus(
    tenantId: string,
    id: string,
    expected: InvitationStatus,
    desired: InvitationStatus,
    meta?: InvitationStatusTransitionMeta,
  ): Promise<Invitation | null>;
  /** Count all invitations created at or after since for this tenant, regardless of status. */
  abstract countIssuedByTenant(tenantId: string, since: Date): Promise<number>;
  abstract countPendingByTenant(tenantId: string, since: Date): Promise<number>;

  static issuanceWindows(config: RateLimitConfig, now: number) {
    InvitationStore.assertRateLimitConfig(config);
    const hour = 60 * 60 * 1000;
    return [
      { period: "hour", duration: hour, limit: config.maxInvitesPerHour },
      { period: "day", duration: 24 * hour, limit: config.maxInvitesPerDay },
    ].map(({ period, duration, limit }) => ({
      since: new Date(now - duration),
      assertAvailable(count: number): void {
        if (count >= limit) {
          throw new InvitationRateLimitExceededProblem(`${limit} per ${period}`);
        }
      },
    }));
  }

  static assertNoPendingInvitation(invitation: Invitation | null, now: number): void {
    if (
      invitation?.status === "pending" &&
      invitation.email !== null &&
      invitation.expiresAt.getTime() > now
    ) {
      throw new DuplicateInvitationProblem(invitation.tenantId, invitation.email);
    }
  }

  static expiryDate(issuedAt: Date, expiresInDays: number): Date {
    const expiresAt = new Date(issuedAt);
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    if (
      !Number.isSafeInteger(expiresInDays) ||
      expiresInDays <= 0 ||
      !Number.isFinite(expiresAt.getTime())
    ) {
      throw new InvalidInvitationExpiryDurationProblem(expiresInDays);
    }
    return expiresAt;
  }

  static dateCreation(
    input: EmailInvitationCreationInput,
    issuedAt: Date,
    expiresInDays: number,
  ): EmailInvitationCreationInput {
    return {
      ...input,
      createdAt: issuedAt,
      eventOccurredAt: issuedAt,
      invitation: {
        ...input.invitation,
        createdAt: issuedAt,
        expiresAt: InvitationStore.expiryDate(issuedAt, expiresInDays),
      },
    };
  }
}
