import type { AuthUser } from "@croco/auth-core";
import type { IdempotencyStore } from "@croco/idempotency-core";
import type { WebhookGatewayStoredResult } from "@croco/webhooks-core";

/**
 * Better Auth 웹훅 이벤트 페이로드입니다.
 */
export type BetterAuthWebhookEvent = {
  id?: string;
  type: "user.created" | "user.updated" | "user.deleted" | "session.created" | "session.revoked";
  data: Record<string, unknown>;
  timestamp: Date;
};

/**
 * Better Auth 이벤트 타입별 웹훅 핸들러 맵입니다.
 */
export type BetterAuthWebhookHandler = {
  "user.created"?: (data: Record<string, unknown>) => Promise<void>;
  "user.updated"?: (data: Record<string, unknown>) => Promise<void>;
  "user.deleted"?: (data: Record<string, unknown>) => Promise<void>;
  "session.created"?: (data: Record<string, unknown>) => Promise<void>;
  "session.revoked"?: (data: Record<string, unknown>) => Promise<void>;
};

/**
 * Better Auth 웹훅 검증 옵션입니다.
 */
export type BetterAuthWebhookOptions = {
  signingSecret: string;
  idempotencyStore: IdempotencyStore<WebhookGatewayStoredResult>;
};

/**
 * Better Auth 세션 데이터 구조입니다.
 */
export type BetterAuthSession = {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Better Auth 세션 제공자가 구현해야 하는 인터페이스입니다.
 */
export interface BetterAuthSessionProvider {
  getSession(token: string): Promise<BetterAuthSession | null>;

  /** 현재 세션으로 인증한 뒤 지정한 세션을 해제합니다. */
  revokeSession(targetSessionToken: string, authorizationSessionToken: string): Promise<void>;

  /** `session:revoke` 권한이 있는 관리자 세션으로 사용자의 모든 세션을 해제합니다. */
  revokeUserSessions(userId: string, adminSessionToken: string): Promise<void>;
}

/**
 * Better Auth 사용자 정보를 확장한 인증 사용자 타입입니다.
 */
export type BetterAuthUser = AuthUser & {
  metadata: {
    name?: string;
    image?: string;
    emailVerified?: boolean;
  };
};
