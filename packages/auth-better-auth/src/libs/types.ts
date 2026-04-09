import type { AuthUser } from '@croco/auth-core';

/**
 * Better Auth 웹훅 이벤트 페이로드입니다.
 */
export type BetterAuthWebhookEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted' | 'session.created' | 'session.revoked';
  data: Record<string, unknown>;
  timestamp: Date;
};

/**
 * Better Auth 이벤트 타입별 웹훅 핸들러 맵입니다.
 */
export type BetterAuthWebhookHandler = {
  'user.created'?: (data: Record<string, unknown>) => Promise<void>;
  'user.updated'?: (data: Record<string, unknown>) => Promise<void>;
  'user.deleted'?: (data: Record<string, unknown>) => Promise<void>;
  'session.created'?: (data: Record<string, unknown>) => Promise<void>;
  'session.revoked'?: (data: Record<string, unknown>) => Promise<void>;
};

/**
 * Better Auth 웹훅 검증 옵션입니다.
 */
export type BetterAuthWebhookOptions = {
  signingSecret: string;
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
  revokeSession(sessionId: string): Promise<void>;
  revokeUserSessions(userId: string): Promise<void>;
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
