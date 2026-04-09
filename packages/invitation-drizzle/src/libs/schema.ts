import type { InvitationStatus, InvitationType } from '@croco/invitation-core';
import { boolean, index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

type InvitationRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * 초대 엔터티를 저장하는 PostgreSQL 스키마입니다.
 */
export const invitations = pgTable(
  'invitations',
  {
    id: text('id').notNull().primaryKey(),
    tenantId: text('tenant_id').notNull(),
    inviterId: text('inviter_id').notNull(),
    email: text('email'),
    tokenHash: text('token_hash').notNull(),
    type: text('type', { enum: ['email', 'link'] })
      .$type<InvitationType>()
      .notNull(),
    role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] })
      .$type<InvitationRole>()
      .notNull(),
    status: text('status', { enum: ['pending', 'accepted', 'expired', 'revoked', 'declined'] })
      .$type<InvitationStatus>()
      .notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('invitations_token_hash_unique').on(table.tokenHash),
    index('invitations_tenant_id_idx').on(table.tenantId),
    index('invitations_tenant_id_email_status_idx').on(table.tenantId, table.email, table.status),
  ]
);

/**
 * 도메인 정책 엔터티를 저장하는 PostgreSQL 스키마입니다.
 */
export const domainPolicies = pgTable(
  'domain_policies',
  {
    id: text('id').notNull().primaryKey(),
    tenantId: text('tenant_id').notNull(),
    domain: text('domain').notNull(),
    role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] })
      .$type<InvitationRole>()
      .notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('domain_policies_tenant_id_domain_unique').on(table.tenantId, table.domain),
    index('domain_policies_tenant_id_idx').on(table.tenantId),
  ]
);
