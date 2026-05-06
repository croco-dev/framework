import { randomUUID } from 'node:crypto';
import type { EventPublisher } from '@croco/events-core';
import { Component } from '@croco/framework-context';
import type { AbstractMembershipManager, MembershipRole } from '@croco/membership-core';
import { NotificationChannel, type NotificationPayload, type NotificationService } from '@croco/notifications-core';
import type { TxManager } from '@croco/tx-core';
import {
  InvitationAcceptedEvent,
  InvitationCreatedEvent,
  InvitationDeclinedEvent,
  InvitationRevokedEvent,
} from './events/InvitationEvents';
import type { InvitationStore } from './InvitationStore';
import {
  InvitationAlreadyAcceptedProblem,
  InvitationEmailMismatchProblem,
  InvitationExpiredProblem,
  InvitationInvalidStatusProblem,
  InvitationNotFoundProblem,
} from './problems/InvitationProblems';
import { generateToken, hashToken } from './token';
import type { Invitation, InvitationStatus, InvitationType } from './types';

const DEFAULT_EMAIL_EXPIRES_IN_DAYS = 7;
const DEFAULT_LINK_EXPIRES_IN_DAYS = 30;

export type CreateEmailInvitationInput = {
  tenantId: string;
  inviterId: string;
  email: string;
  role: MembershipRole;
  expiresInDays?: number;
};

export type CreateLinkInvitationInput = {
  tenantId: string;
  inviterId: string;
  role: MembershipRole;
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
    private readonly txManager: TxManager<unknown>
  ) {}

  async createEmailInvitation(input: CreateEmailInvitationInput): Promise<string> {
    const email = this.normalizeEmail(input.email);
    const token = generateToken();
    const invitation = this.buildInvitation({
      tenantId: input.tenantId,
      inviterId: input.inviterId,
      email,
      role: input.role,
      type: 'email',
      token,
      expiresInDays: input.expiresInDays,
    });

    await this.store.save(invitation);
    await this.sendInvitationNotification(invitation, token);
    await this.publishSafely(
      new InvitationCreatedEvent({
        invitationId: invitation.id,
        tenantId: invitation.tenantId,
        inviterId: invitation.inviterId,
        email: invitation.email,
        role: invitation.role,
        type: invitation.type,
        expiresAt: invitation.expiresAt,
      })
    );

    return token;
  }

  async createLinkInvitation(input: CreateLinkInvitationInput): Promise<string> {
    const token = generateToken();
    const invitation = this.buildInvitation({
      tenantId: input.tenantId,
      inviterId: input.inviterId,
      email: null,
      role: input.role,
      type: 'link',
      token,
      expiresInDays: input.expiresInDays,
    });

    await this.store.save(invitation);
    await this.publishSafely(
      new InvitationCreatedEvent({
        invitationId: invitation.id,
        tenantId: invitation.tenantId,
        inviterId: invitation.inviterId,
        email: invitation.email,
        role: invitation.role,
        type: invitation.type,
        expiresAt: invitation.expiresAt,
      })
    );

    return token;
  }

  async acceptInvitation(input: AcceptInvitationInput): Promise<Invitation> {
    const invitation = await this.getByTokenOrThrow(input.token);
    this.ensureAcceptableStatus(invitation, 'accept');

    if (this.isExpired(invitation)) {
      const expiredInvitation = await this.updateInvitation(invitation, {
        status: 'expired',
      });
      throw new InvitationExpiredProblem(expiredInvitation.id);
    }

    if (invitation.type === 'email') {
      const providedEmail = this.normalizeOptionalEmail(input.email);
      if (!providedEmail || providedEmail !== invitation.email) {
        throw new InvitationEmailMismatchProblem(invitation.id, invitation.email, providedEmail);
      }
    }

    return this.txManager.run(async () => {
      const accepted = await this.store.compareAndSetStatus(invitation.tenantId, invitation.id, 'pending', 'accepted', {
        acceptedAt: new Date(),
      });

      if (!accepted) {
        throw new InvitationAlreadyAcceptedProblem(invitation.id);
      }

      await this.membershipManager.addMember(invitation.tenantId, input.userId, invitation.role);

      this.txManager.onAfterCommit(() =>
        this.publishSafely(
          new InvitationAcceptedEvent({
            invitationId: accepted.id,
            tenantId: accepted.tenantId,
            userId: input.userId,
            email: accepted.email,
            role: accepted.role,
            type: accepted.type,
          })
        )
      );

      return accepted;
    });
  }

  async declineInvitation(token: string): Promise<Invitation> {
    const invitation = await this.getByTokenOrThrow(token);
    this.ensurePendingStatus(invitation, 'decline');

    const declined = await this.updateInvitation(invitation, {
      status: 'declined',
    });

    await this.publishSafely(
      new InvitationDeclinedEvent({
        invitationId: declined.id,
        tenantId: declined.tenantId,
        email: declined.email,
        role: declined.role,
        type: declined.type,
      })
    );

    return declined;
  }

  async revokeInvitation(invitationId: string): Promise<Invitation> {
    const invitation = await this.store.findById(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundProblem(invitationId);
    }

    if (invitation.status === 'accepted') {
      throw new InvitationInvalidStatusProblem(invitation.id, invitation.status, 'revoke');
    }

    if (invitation.status === 'revoked') {
      return invitation;
    }

    const revoked = await this.updateInvitation(invitation, {
      status: 'revoked',
      revokedAt: new Date(),
    });

    await this.publishSafely(
      new InvitationRevokedEvent({
        invitationId: revoked.id,
        tenantId: revoked.tenantId,
        email: revoked.email,
        role: revoked.role,
        type: revoked.type,
      })
    );

    return revoked;
  }

  async resendInvitation(invitationId: string): Promise<string> {
    const invitation = await this.store.findById(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundProblem(invitationId);
    }

    if (invitation.status === 'accepted') {
      throw new InvitationInvalidStatusProblem(invitation.id, invitation.status, 'resend');
    }

    await this.revokeInvitation(invitation.id);

    if (invitation.type === 'email') {
      const token = await this.createEmailInvitation({
        tenantId: invitation.tenantId,
        inviterId: invitation.inviterId,
        email: invitation.email ?? '',
        role: invitation.role,
      });
      return token;
    }

    return this.createLinkInvitation({
      tenantId: invitation.tenantId,
      inviterId: invitation.inviterId,
      role: invitation.role,
    });
  }

  private buildInvitation(input: {
    tenantId: string;
    inviterId: string;
    email: string | null;
    role: MembershipRole;
    type: InvitationType;
    token: string;
    expiresInDays?: number;
  }): Invitation {
    const createdAt = new Date();
    const expiresInDays =
      input.expiresInDays ?? (input.type === 'email' ? DEFAULT_EMAIL_EXPIRES_IN_DAYS : DEFAULT_LINK_EXPIRES_IN_DAYS);

    return {
      id: randomUUID(),
      tenantId: input.tenantId,
      inviterId: input.inviterId,
      email: input.email,
      tokenHash: hashToken(input.token),
      type: input.type,
      role: input.role,
      status: 'pending',
      expiresAt: this.addDays(createdAt, expiresInDays),
      acceptedAt: null,
      revokedAt: null,
      createdAt,
    };
  }

  private async getByTokenOrThrow(token: string): Promise<Invitation> {
    const tokenHash = hashToken(token);
    const invitation = await this.store.findByTokenHash(tokenHash);

    if (!invitation) {
      throw new InvitationNotFoundProblem(token);
    }

    return invitation;
  }

  private ensureAcceptableStatus(invitation: Invitation, operation: string): void {
    if (invitation.status === 'accepted') {
      throw new InvitationAlreadyAcceptedProblem(invitation.id);
    }

    if (invitation.status === 'revoked' || invitation.status === 'declined' || invitation.status === 'expired') {
      throw new InvitationInvalidStatusProblem(invitation.id, invitation.status, operation);
    }
  }

  private ensurePendingStatus(invitation: Invitation, operation: string): void {
    if (invitation.status !== 'pending') {
      throw new InvitationInvalidStatusProblem(invitation.id, invitation.status, operation);
    }

    if (this.isExpired(invitation)) {
      throw new InvitationExpiredProblem(invitation.id);
    }
  }

  private isExpired(invitation: Invitation): boolean {
    return invitation.expiresAt.getTime() <= Date.now();
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

  private addDays(base: Date, days: number): Date {
    const result = new Date(base);
    result.setDate(result.getDate() + days);
    return result;
  }

  private async sendInvitationNotification(invitation: Invitation, token: string): Promise<void> {
    if (!invitation.email) {
      return;
    }

    const payload: NotificationPayload = {
      to: invitation.email,
      subject: 'You are invited to join tenant',
      content: `Use this invitation token: ${token}`,
      metadata: {
        invitationId: invitation.id,
        tenantId: invitation.tenantId,
        inviterId: invitation.inviterId,
      },
    };

    await this.notificationService.send(NotificationChannel.EMAIL, payload);
  }

  private async updateInvitation(
    invitation: Invitation,
    patch: {
      status?: InvitationStatus;
      acceptedAt?: Date | null;
      revokedAt?: Date | null;
    }
  ): Promise<Invitation> {
    const updated: Invitation = {
      ...invitation,
      status: patch.status ?? invitation.status,
      acceptedAt: patch.acceptedAt ?? invitation.acceptedAt,
      revokedAt: patch.revokedAt ?? invitation.revokedAt,
    };

    await this.store.save(updated);
    return updated;
  }

  private async publishSafely(
    event: InvitationCreatedEvent | InvitationAcceptedEvent | InvitationRevokedEvent | InvitationDeclinedEvent
  ): Promise<void> {
    await this.eventPublisher.publish(event);
  }
}
