import type { MembershipRole } from '@croco/membership-core';

/**
 * Invitation type enumeration
 */
export type InvitationType = 'email' | 'link';

/**
 * Invitation status enumeration
 */
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked' | 'declined';

/**
 * Invitation entity
 */
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

/**
 * Input for creating an invitation
 */
export type InvitationCreateInput = {
  tenantId: string;
  inviterId: string;
  email: string | null;
  type: InvitationType;
  role: MembershipRole;
  expiresInDays?: number;
};

/**
 * Domain policy for auto-join
 */
export type DomainPolicy = {
  id: string;
  tenantId: string;
  domain: string;
  role: MembershipRole;
  enabled: boolean;
  createdAt: Date;
};

/**
 * Input for creating a domain policy
 */
export type DomainPolicyCreateInput = {
  tenantId: string;
  domain: string;
  role: MembershipRole;
};

/**
 * Public email domains denylist (not allowed for auto-join)
 */
export const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'protonmail.com',
] as const;
