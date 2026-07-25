import type { InvitationStatus, InvitationType } from "@croco/invitation-core";
import { boolean, index, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";

type InvitationRole = "owner" | "admin" | "member" | "viewer";

/**
 * 초대 엔터티를 저장하는 PostgreSQL 스키마입니다.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: text("id").notNull().primaryKey(),
    tenantId: text("tenant_id").notNull(),
    inviterId: text("inviter_id").notNull(),
    email: text("email"),
    tokenHash: text("token_hash").notNull(),
    type: text("type", { enum: ["email", "link"] })
      .$type<InvitationType>()
      .notNull(),
    role: text("role", { enum: ["owner", "admin", "member", "viewer"] })
      .$type<InvitationRole>()
      .notNull(),
    status: text("status", {
      enum: ["creating", "pending", "accepted", "expired", "revoked", "declined"],
    })
      .$type<InvitationStatus>()
      .notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("invitations_token_hash_unique").on(table.tokenHash),
    index("invitations_tenant_id_idx").on(table.tenantId),
    index("invitations_tenant_id_email_status_idx").on(table.tenantId, table.email, table.status),
  ],
);

/**
 * 이메일 초대 생성의 멱등성 키와 재생 가능한 알림/이벤트 전달 의도를 저장합니다.
 */
export const invitationEmailCreationIntents = pgTable(
  "invitation_email_creation_intents",
  {
    invitationId: text("invitation_id").notNull().primaryKey(),
    tenantId: text("tenant_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    tokenCiphertext: text("token_ciphertext").notNull(),
    notificationIdempotencyKey: text("notification_idempotency_key").notNull(),
    notificationStatus: text("notification_status", {
      enum: ["pending", "processing", "completed"],
    })
      .notNull()
      .default("pending"),
    notificationClaimId: text("notification_claim_id"),
    notificationClaimExpiresAt: timestamp("notification_claim_expires_at"),
    eventStatus: text("event_status", { enum: ["pending", "processing", "completed"] })
      .notNull()
      .default("pending"),
    eventClaimId: text("event_claim_id"),
    eventClaimExpiresAt: timestamp("event_claim_expires_at"),
    eventId: text("event_id").notNull(),
    eventOccurredAt: timestamp("event_occurred_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("invitation_email_creation_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("invitation_email_creation_status_idx").on(table.notificationStatus, table.eventStatus),
  ],
);

/**
 * 도메인 정책 엔터티를 저장하는 PostgreSQL 스키마입니다.
 */
export const domainPolicies = pgTable(
  "domain_policies",
  {
    id: text("id").notNull().primaryKey(),
    tenantId: text("tenant_id").notNull(),
    domain: text("domain").notNull(),
    role: text("role", { enum: ["owner", "admin", "member", "viewer"] })
      .$type<InvitationRole>()
      .notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("domain_policies_tenant_id_domain_unique").on(table.tenantId, table.domain),
    index("domain_policies_tenant_id_idx").on(table.tenantId),
  ],
);
