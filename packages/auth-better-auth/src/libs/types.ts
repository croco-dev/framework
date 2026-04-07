import type { AuthUser } from '@croco/auth-core';

export type BetterAuthWebhookEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted' | 'session.created' | 'session.revoked';
  data: Record<string, unknown>;
  timestamp: Date;
};

export type BetterAuthWebhookHandler = {
  'user.created'?: (data: Record<string, unknown>) => Promise<void>;
  'user.updated'?: (data: Record<string, unknown>) => Promise<void>;
  'user.deleted'?: (data: Record<string, unknown>) => Promise<void>;
  'session.created'?: (data: Record<string, unknown>) => Promise<void>;
  'session.revoked'?: (data: Record<string, unknown>) => Promise<void>;
};

export type BetterAuthWebhookOptions = {
  signingSecret: string;
};

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

export interface BetterAuthSessionProvider {
  getSession(token: string): Promise<BetterAuthSession | null>;
  revokeSession(sessionId: string): Promise<void>;
  revokeUserSessions(userId: string): Promise<void>;
}

export type BetterAuthUser = AuthUser & {
  metadata: {
    name?: string;
    image?: string;
    emailVerified?: boolean;
  };
};
