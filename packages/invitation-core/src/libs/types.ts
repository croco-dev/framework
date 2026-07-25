import type { MembershipRole } from "@croco/membership-core";

export type InvitationType = "email" | "link";

export type InvitationStatus =
  | "creating"
  | "pending"
  | "accepted"
  | "expired"
  | "revoked"
  | "declined";

export type InvitationCreationPhaseStatus = "pending" | "processing" | "completed";

export type Invitation = {
  id: string;
  tenantId: string;
  inviterId: string;
  email: string | null;
  tokenHash: string;
  type: InvitationType;
  role: MembershipRole;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type EmailInvitationCreation = {
  invitation: Invitation;
  token: string;
  idempotencyKey: string;
  requestFingerprint: string;
  notificationIdempotencyKey: string;
  notificationStatus: InvitationCreationPhaseStatus;
  notificationClaimId: string | null;
  notificationClaimExpiresAt: Date | null;
  eventStatus: InvitationCreationPhaseStatus;
  eventClaimId: string | null;
  eventClaimExpiresAt: Date | null;
  eventId: string;
  eventOccurredAt: Date;
  createdAt: Date;
};

export type EmailInvitationCreationInput = EmailInvitationCreation;

export type InvitationCreateInput = {
  tenantId: string;
  inviterId: string;
  email: string | null;
  type: InvitationType;
  role: MembershipRole;
  expiresInDays?: number;
};

export type CreateEmailInvitationInput = {
  idempotencyKey: string;
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

export type DomainPolicy = {
  id: string;
  tenantId: string;
  domain: string;
  role: MembershipRole;
  enabled: boolean;
  createdAt: Date;
};

export type DomainPolicyCreateInput = {
  tenantId: string;
  domain: string;
  role: MembershipRole;
};

export type BatchInviteResult = {
  successful: Array<{
    email: string;
    token: string;
  }>;
  failed: Array<{
    email: string;
    error: string;
  }>;
};

export type BatchInviteOptions = {
  expiresInDays?: number;
  idempotencyKey?: string;
  maxBatchSize?: number;
};

export type RateLimitConfig = {
  maxInvitesPerHour: number;
  maxInvitesPerDay: number;
};

/**
 * Public email domains denylist (not allowed for auto-join)
 */
export const PUBLIC_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "protonmail.com",
] as const;
