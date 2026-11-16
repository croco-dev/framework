import { randomUUID } from "node:crypto";
import type { EventPublisher } from "@croco/events-core";
import { Component } from "@croco/framework-context";
import type { AbstractMembershipManager, MembershipRole } from "@croco/membership-core";
import {
  createNotificationIdempotencyKey,
  NotificationChannel,
  type NotificationPayload,
  type NotificationService,
} from "@croco/notifications-core";
import { Problem } from "@croco/problems-core";
import { recordError, recordEvent } from "@croco/telemetry-api";
import type { TxManager, TxRunOutcome } from "@croco/tx-core";
import {
  InvitationAcceptedEvent,
  InvitationCreatedEvent,
  InvitationDeclinedEvent,
  InvitationRevokedEvent,
} from "./events/InvitationEvents";
import { InvitationStore } from "./InvitationStore";
import {
  InvitationAlreadyAcceptedProblem,
  InvitationCreationFailedProblem,
  InvitationEmailMismatchProblem,
  InvitationExpiredProblem,
  InvitationInvalidStatusProblem,
  InvitationNotFoundProblem,
} from "./problems/InvitationProblems";
import { InvitationRateLimitUnavailableProblem } from "./problems/RateLimitProblems";
import { generateToken, hashToken } from "./token";
import type {
  EmailInvitationCreation,
  EmailInvitationCreationInput,
  Invitation,
  InvitationType,
  RateLimitConfig,
} from "./types";

const DEFAULT_EMAIL_EXPIRES_IN_DAYS = 7;
const DEFAULT_LINK_EXPIRES_IN_DAYS = 30;
const CREATION_CLAIM_LEASE_MS = 5 * 60 * 1000;

export type CreateEmailInvitationInput = {
  idempotencyKey: string;
  tenantId: string;
  inviterId: string;
  email: string;
  role: MembershipRole;
  /** Positive integer number of calendar days. Fractional days are not supported. */
  expiresInDays?: number;
};

export type CreateLinkInvitationInput = {
  idempotencyKey: string;
  tenantId: string;
  inviterId: string;
  role: MembershipRole;
  /** Positive integer number of calendar days. Fractional days are not supported. */
  expiresInDays?: number;
};

export type AcceptInvitationInput = {
  token: string;
  userId: string;
  email?: string;
};

@Component()
export class InvitationManager {
  constructor(
    private readonly store: InvitationStore,
    private readonly membershipManager: AbstractMembershipManager,
    private readonly notificationService: NotificationService,
    private readonly eventPublisher: EventPublisher,
    private readonly txManager: TxManager<unknown>,
  ) {}

  createEmailInvitation(input: CreateEmailInvitationInput): Promise<string> {
    return this.issueEmailInvitation(input);
  }

  async createEmailInvitationWithRateLimit(
    input: CreateEmailInvitationInput,
    rateLimit: RateLimitConfig,
  ): Promise<string> {
    InvitationStore.assertRateLimitConfig(rateLimit);
    return this.issueEmailInvitation(input, rateLimit);
  }

  private async issueEmailInvitation(
    input: CreateEmailInvitationInput,
    rateLimit?: RateLimitConfig,
  ): Promise<string> {
    const expiresInDays = input.expiresInDays ?? DEFAULT_EMAIL_EXPIRES_IN_DAYS;
    const invitationId = randomUUID();
    const expiry = await this.resolveExpiry(invitationId, expiresInDays, rateLimit !== undefined);
    if (rateLimit === undefined) {
      await this.deleteExpiredCreationIntentsSafely(expiry.createdAt);
    }
    const email = this.normalizeEmail(input.email);
    const token = generateToken();
    const invitation = this.buildInvitation({
      id: invitationId,
      tenantId: input.tenantId,
      inviterId: input.inviterId,
      email,
      role: input.role,
      type: "email",
      token,
      ...expiry,
    });
    const event = this.createInvitationCreatedEvent(invitation);
    const notificationIdempotencyKey = this.createInvitationNotificationIdempotencyKey(
      invitation,
      input.idempotencyKey,
      rateLimit !== undefined,
    );
    let creation;
    try {
      creation = await this.persistCreation(
        {
          invitation,
          token,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: hashToken(
            JSON.stringify([
              input.tenantId,
              input.inviterId,
              email,
              input.role,
              input.expiresInDays ?? DEFAULT_EMAIL_EXPIRES_IN_DAYS,
            ]),
          ),
          notificationIdempotencyKey,
          notificationStatus: "pending",
          notificationClaimId: null,
          notificationClaimExpiresAt: null,
          eventStatus: "pending",
          eventClaimId: null,
          eventClaimExpiresAt: null,
          eventId: event.eventId,
          eventOccurredAt: invitation.createdAt,
          createdAt: invitation.createdAt,
        },
        rateLimit,
        expiresInDays,
      );
    } catch (error) {
      if (error instanceof Problem) {
        throw error;
      }
      this.throwCreationPendingProblem(invitation.id, "persistence");
    }

    creation = await this.publishCreationEvent(creation);

    if (creation.notificationStatus !== "completed") {
      const { claimId, claimed } = await this.claimCreation("notification", creation);
      try {
        await this.sendInvitationNotification(
          claimed.invitation,
          claimed.token,
          claimed.notificationIdempotencyKey,
        );
        const completed = await this.store.completeEmailInvitationNotification(
          claimed.invitation.tenantId,
          claimed.idempotencyKey,
          claimId,
        );
        if (
          completed?.invitation.id !== claimed.invitation.id ||
          completed.notificationStatus !== "completed"
        ) {
          this.throwCreationPendingProblem(claimed.invitation.id, "notification");
        }
        creation = completed;
      } catch {
        await this.releaseCreationClaimSafely("notification", claimed, claimId);
        this.throwCreationPendingProblem(claimed.invitation.id, "notification");
      }
    }

    return this.activateCreation(creation, rateLimit !== undefined);
  }

  createLinkInvitation(input: CreateLinkInvitationInput): Promise<string> {
    return this.issueLinkInvitation(input);
  }

  async createLinkInvitationWithRateLimit(
    input: CreateLinkInvitationInput,
    rateLimit: RateLimitConfig,
  ): Promise<string> {
    InvitationStore.assertRateLimitConfig(rateLimit);
    return this.issueLinkInvitation(input, rateLimit);
  }

  private async issueLinkInvitation(
    input: CreateLinkInvitationInput,
    rateLimit?: RateLimitConfig,
  ): Promise<string> {
    const expiresInDays = input.expiresInDays ?? DEFAULT_LINK_EXPIRES_IN_DAYS;
    const invitationId = randomUUID();
    const expiry = await this.resolveExpiry(invitationId, expiresInDays, rateLimit !== undefined);
    if (rateLimit === undefined) {
      await this.deleteExpiredCreationIntentsSafely(expiry.createdAt);
    }
    const token = generateToken();
    const invitation = this.buildInvitation({
      id: invitationId,
      tenantId: input.tenantId,
      inviterId: input.inviterId,
      email: null,
      role: input.role,
      type: "link",
      token,
      ...expiry,
    });
    const event = this.createInvitationCreatedEvent(invitation);
    let creation;
    try {
      creation = await this.persistCreation(
        {
          invitation,
          token,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: hashToken(
            JSON.stringify([
              input.tenantId,
              input.inviterId,
              input.role,
              input.expiresInDays ?? DEFAULT_LINK_EXPIRES_IN_DAYS,
              "link",
              1,
            ]),
          ),
          notificationIdempotencyKey: `link:${input.idempotencyKey}`,
          notificationStatus: "completed",
          notificationClaimId: null,
          notificationClaimExpiresAt: null,
          eventStatus: "pending",
          eventClaimId: null,
          eventClaimExpiresAt: null,
          eventId: event.eventId,
          eventOccurredAt: invitation.createdAt,
          createdAt: invitation.createdAt,
        },
        rateLimit,
        expiresInDays,
      );
    } catch (error) {
      if (error instanceof Problem) {
        throw error;
      }
      this.throwCreationPendingProblem(invitation.id, "persistence");
    }

    creation = await this.publishCreationEvent(creation);
    return this.activateCreation(creation, rateLimit !== undefined);
  }

  private async activateCreation(
    creation: EmailInvitationCreation,
    allowTerminalReplay: boolean,
  ): Promise<string> {
    try {
      const activated = await this.store.activateEmailInvitation(
        creation.invitation.tenantId,
        creation.idempotencyKey,
        creation.invitation.id,
      );
      if (
        activated?.invitation.id !== creation.invitation.id ||
        activated.invitation.status === "creating" ||
        (!allowTerminalReplay && activated.invitation.status !== "pending") ||
        activated.notificationStatus !== "completed" ||
        activated.eventStatus !== "completed"
      ) {
        this.throwCreationPendingProblem(creation.invitation.id, "persistence");
      }
      return activated.token;
    } catch (error) {
      if (error instanceof Problem) {
        throw error;
      }
      this.throwCreationPendingProblem(creation.invitation.id, "persistence");
    }
  }

  private persistCreation(
    input: EmailInvitationCreationInput,
    rateLimit: RateLimitConfig | undefined,
    expiresInDays: number,
  ): Promise<EmailInvitationCreation> {
    if (rateLimit === undefined) {
      return this.store.createEmailInvitation(input);
    }
    if (!this.store.createRateLimitedInvitation) {
      throw new InvitationRateLimitUnavailableProblem("unsupported-store");
    }
    return this.store.createRateLimitedInvitation(input, rateLimit, expiresInDays);
  }

  async acceptInvitation(input: AcceptInvitationInput): Promise<TxRunOutcome<Invitation>> {
    const invitation = await this.getByTokenOrThrow(input.token);
    this.ensureAcceptableStatus(invitation, "accept");

    if (await this.isExpired(invitation)) {
      const expired = await this.store.compareAndSetStatus(
        invitation.tenantId,
        invitation.id,
        "pending",
        "expired",
      );
      if (expired) {
        throw new InvitationExpiredProblem(expired.id);
      }
      const current = await this.store.findById(invitation.id);
      if (!current) {
        throw new InvitationNotFoundProblem("");
      }
      if (
        current.status === "expired" ||
        (current.status === "pending" && (await this.isExpired(current)))
      ) {
        throw new InvitationExpiredProblem(current.id);
      }
      this.ensureAcceptableStatus(current, "accept");
      throw new InvitationInvalidStatusProblem(current.id, current.status, "accept");
    }

    if (invitation.type === "email") {
      const providedEmail = this.normalizeOptionalEmail(input.email);
      if (!providedEmail || providedEmail !== invitation.email) {
        throw new InvitationEmailMismatchProblem(invitation.id, invitation.email, providedEmail);
      }
    }

    return this.txManager.runWithOutcome(async () => {
      const accepted = await this.store.compareAndSetStatus(
        invitation.tenantId,
        invitation.id,
        "pending",
        "accepted",
      );

      if (!accepted) {
        const current = await this.store.findById(invitation.id);
        if (!current) {
          throw new InvitationNotFoundProblem("");
        }

        if (
          current.status === "expired" ||
          (current.status === "pending" && (await this.isExpired(current)))
        ) {
          throw new InvitationExpiredProblem(current.id);
        }

        this.ensureAcceptableStatus(current, "accept");
        throw new InvitationInvalidStatusProblem(current.id, current.status, "accept");
      }

      await this.membershipManager.addMember(
        invitation.tenantId,
        input.userId,
        invitation.role,
        `invitation-accept:${invitation.id}:${input.userId}`,
      );

      this.txManager.onAfterCommit(() =>
        this.publishSafely(
          new InvitationAcceptedEvent({
            invitationId: accepted.id,
            tenantId: accepted.tenantId,
            userId: input.userId,
            email: accepted.email,
            role: accepted.role,
            type: accepted.type,
          }),
        ),
      );

      return accepted;
    });
  }

  async declineInvitation(token: string): Promise<Invitation> {
    const invitation = await this.getByTokenOrThrow(token);
    await this.ensurePendingStatus(invitation, "decline");

    const declined = await this.store.compareAndSetStatus(
      invitation.tenantId,
      invitation.id,
      "pending",
      "declined",
    );
    if (!declined) {
      const current = await this.store.findById(invitation.id);
      if (!current) {
        throw new InvitationNotFoundProblem("");
      }
      throw new InvitationInvalidStatusProblem(current.id, current.status, "decline");
    }

    await this.publishSafely(
      new InvitationDeclinedEvent({
        invitationId: declined.id,
        tenantId: declined.tenantId,
        email: declined.email,
        role: declined.role,
        type: declined.type,
      }),
    );

    return declined;
  }

  async revokeInvitation(invitationId: string): Promise<Invitation> {
    const invitation = await this.store.findById(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundProblem("");
    }

    if (invitation.status === "accepted" || invitation.status === "expired") {
      throw new InvitationInvalidStatusProblem(invitation.id, invitation.status, "revoke");
    }

    if (invitation.status === "revoked") {
      return invitation;
    }

    if (invitation.status !== "pending") {
      throw new InvitationInvalidStatusProblem(invitation.id, invitation.status, "revoke");
    }

    const revoked = await this.store.compareAndSetStatus(
      invitation.tenantId,
      invitation.id,
      "pending",
      "revoked",
      { revokedAt: new Date(await InvitationStore.currentTimeMillis(this.store)) },
    );
    if (!revoked) {
      const current = await this.store.findById(invitation.id);
      if (!current) {
        throw new InvitationNotFoundProblem("");
      }
      if (current.status === "revoked") {
        return current;
      }
      throw new InvitationInvalidStatusProblem(current.id, current.status, "revoke");
    }

    await this.publishSafely(
      new InvitationRevokedEvent({
        invitationId: revoked.id,
        tenantId: revoked.tenantId,
        email: revoked.email,
        role: revoked.role,
        type: revoked.type,
      }),
    );

    return revoked;
  }

  async resendInvitation(invitationId: string, idempotencyKey: string): Promise<string> {
    const invitation = await this.store.findById(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundProblem("");
    }

    if (invitation.status === "accepted") {
      throw new InvitationInvalidStatusProblem(invitation.id, invitation.status, "resend");
    }

    if (invitation.status !== "expired") {
      await this.revokeInvitation(invitation.id);
    }

    if (invitation.type === "email") {
      const token = await this.createEmailInvitation({
        idempotencyKey,
        tenantId: invitation.tenantId,
        inviterId: invitation.inviterId,
        email: invitation.email ?? "",
        role: invitation.role,
      });
      return token;
    }

    return this.createLinkInvitation({
      idempotencyKey,
      tenantId: invitation.tenantId,
      inviterId: invitation.inviterId,
      role: invitation.role,
    });
  }

  private buildInvitation(input: {
    id: string;
    tenantId: string;
    inviterId: string;
    email: string | null;
    role: MembershipRole;
    type: InvitationType;
    token: string;
    createdAt: Date;
    expiresAt: Date;
  }): Invitation {
    return {
      id: input.id,
      tenantId: input.tenantId,
      inviterId: input.inviterId,
      email: input.email,
      tokenHash: hashToken(input.token),
      type: input.type,
      role: input.role,
      status: "creating",
      expiresAt: input.expiresAt,
      acceptedAt: null,
      revokedAt: null,
      createdAt: input.createdAt,
    };
  }

  private async resolveExpiry(
    invitationId: string,
    expiresInDays: number,
    rateLimited: boolean,
  ): Promise<{ createdAt: Date; expiresAt: Date }> {
    const now = new Date();
    const expiresAt = InvitationStore.expiryDate(now, expiresInDays);
    if (rateLimited || !this.store.currentTime) {
      return { createdAt: now, expiresAt };
    }

    let createdAt: Date;
    try {
      createdAt = await this.store.currentTime();
    } catch {
      this.throwCreationPendingProblem(invitationId, "persistence");
    }
    return { createdAt, expiresAt: InvitationStore.expiryDate(createdAt, expiresInDays) };
  }

  private async getByTokenOrThrow(token: string): Promise<Invitation> {
    const tokenHash = hashToken(token);
    const invitation = await this.store.findByTokenHash(tokenHash);

    if (!invitation) {
      throw new InvitationNotFoundProblem("");
    }

    return invitation;
  }

  private ensureAcceptableStatus(invitation: Invitation, operation: string): void {
    if (invitation.status === "accepted") {
      throw new InvitationAlreadyAcceptedProblem(invitation.id);
    }

    if (invitation.status !== "pending") {
      throw new InvitationInvalidStatusProblem(invitation.id, invitation.status, operation);
    }
  }

  private async ensurePendingStatus(invitation: Invitation, operation: string): Promise<void> {
    if (invitation.status !== "pending") {
      throw new InvitationInvalidStatusProblem(invitation.id, invitation.status, operation);
    }

    if (await this.isExpired(invitation)) {
      throw new InvitationExpiredProblem(invitation.id);
    }
  }

  private async isExpired(invitation: Invitation): Promise<boolean> {
    return invitation.expiresAt.getTime() <= (await InvitationStore.currentTimeMillis(this.store));
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeOptionalEmail(email?: string): string | null {
    if (!email) {
      return null;
    }

    const normalized = email.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private async sendInvitationNotification(
    invitation: Invitation,
    token: string,
    idempotencyKey: string,
  ): Promise<void> {
    if (!invitation.email) {
      return;
    }

    const payload: NotificationPayload = {
      to: invitation.email,
      subject: "You are invited to join tenant",
      content: `Use this invitation token: ${token}`,
      metadata: {
        invitationId: invitation.id,
        tenantId: invitation.tenantId,
        inviterId: invitation.inviterId,
      },
    };

    const preferenceContext = {
      tenantId: invitation.tenantId,
      userId: invitation.email,
      channel: NotificationChannel.EMAIL,
      topic: "invitation.created",
    };

    await this.notificationService.send(NotificationChannel.EMAIL, payload, {
      idempotencyKey,
      preferenceContext,
      requireProviderIdempotency: true,
    });
  }

  private createInvitationNotificationIdempotencyKey(
    invitation: Invitation,
    idempotencyKey: string,
    rateLimited: boolean,
  ): string {
    const email = invitation.email ?? "";
    return createNotificationIdempotencyKey({
      tenantId: invitation.tenantId,
      userId: email,
      channel: NotificationChannel.EMAIL,
      topic: rateLimited ? "invitation.created.rate-limited" : "invitation.created",
      recipient: email,
      semanticKey: rateLimited ? invitation.id : idempotencyKey,
    });
  }

  private createInvitationCreatedEvent(invitation: Invitation): InvitationCreatedEvent {
    return new InvitationCreatedEvent({
      invitationId: invitation.id,
      tenantId: invitation.tenantId,
      inviterId: invitation.inviterId,
      email: invitation.email,
      role: invitation.role,
      type: invitation.type,
      expiresAt: invitation.expiresAt,
    });
  }

  private async publishSafely(
    event:
      | InvitationCreatedEvent
      | InvitationAcceptedEvent
      | InvitationRevokedEvent
      | InvitationDeclinedEvent,
  ): Promise<void> {
    await this.eventPublisher.publishNow(event);
  }

  private throwCreationPendingProblem(
    invitationId: string,
    phase: "persistence" | "notification" | "event",
  ): never {
    const problem = new InvitationCreationFailedProblem(invitationId, phase);
    recordEvent("invitation.creation.pending", {
      "invitation.id": invitationId,
      "invitation.phase": phase,
    });
    recordError(problem);
    throw problem;
  }

  private async releaseCreationClaimSafely(
    phase: "notification" | "event",
    creation: { invitation: Invitation; idempotencyKey: string },
    claimId: string,
  ): Promise<void> {
    try {
      if (phase === "notification") {
        await this.store.releaseEmailInvitationNotification(
          creation.invitation.tenantId,
          creation.idempotencyKey,
          claimId,
        );
        return;
      }
      await this.store.releaseEmailInvitationEvent(
        creation.invitation.tenantId,
        creation.idempotencyKey,
        claimId,
      );
    } catch {
      recordEvent("invitation.creation.claim_release_failed", {
        "invitation.id": creation.invitation.id,
        "invitation.phase": phase,
      });
    }
  }

  private async publishCreationEvent(
    creation: EmailInvitationCreation,
  ): Promise<EmailInvitationCreation> {
    if (creation.eventStatus === "completed") {
      return creation;
    }

    const { claimId, claimed } = await this.claimCreation("event", creation);
    try {
      const storedEvent = this.createInvitationCreatedEvent(claimed.invitation);
      const eventIdentity = storedEvent as unknown as {
        eventId: string;
        timestamp: Date;
      };
      eventIdentity.eventId = claimed.eventId;
      eventIdentity.timestamp = new Date(claimed.eventOccurredAt);
      await this.eventPublisher.publishNow(storedEvent);
      const completed = await this.store.completeEmailInvitationEvent(
        claimed.invitation.tenantId,
        claimed.idempotencyKey,
        claimId,
      );
      if (
        completed?.invitation.id !== claimed.invitation.id ||
        completed.eventStatus !== "completed"
      ) {
        this.throwCreationPendingProblem(claimed.invitation.id, "event");
      }
      return completed;
    } catch {
      await this.releaseCreationClaimSafely("event", claimed, claimId);
      this.throwCreationPendingProblem(claimed.invitation.id, "event");
    }
  }

  private async claimCreation(
    phase: "notification" | "event",
    creation: EmailInvitationCreation,
  ): Promise<{ claimId: string; claimed: EmailInvitationCreation }> {
    const { tenantId, id } = creation.invitation;
    const { idempotencyKey } = creation;
    const claimId = randomUUID();
    try {
      const expiresAt = new Date(
        (await InvitationStore.currentTimeMillis(this.store)) + CREATION_CLAIM_LEASE_MS,
      );
      const claimed =
        phase === "notification"
          ? await this.store.claimEmailInvitationNotification(
              tenantId,
              idempotencyKey,
              claimId,
              expiresAt,
              id,
            )
          : await this.store.claimEmailInvitationEvent(
              tenantId,
              idempotencyKey,
              claimId,
              expiresAt,
              id,
            );
      if (claimed?.invitation.id === id) {
        return { claimId, claimed };
      }
      if (claimed) {
        await this.releaseCreationClaimSafely(phase, claimed, claimId);
      }
    } catch {
      this.throwCreationPendingProblem(id, phase);
    }
    this.throwCreationPendingProblem(id, phase);
  }

  private async deleteExpiredCreationIntentsSafely(now: Date): Promise<void> {
    try {
      await this.store.deleteExpiredEmailInvitationCreations(now);
    } catch {
      recordEvent("invitation.creation.cleanup_failed");
    }
  }
}
