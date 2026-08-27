import { Token } from "@croco/framework-context";

export type ImpersonationState = {
  readonly sessionId: string;
  readonly impersonatorId: string;
  readonly targetUserId: string;
  readonly reason?: string;
  readonly startedAt: Date;
  readonly expiresAt: Date;
};

export type ImpersonationConfig = {
  maxDurationMs: number;
  requireReason: boolean;
  blockedActions: string[];
};

export const IMPERSONATION_CONFIG_TOKEN = new Token<ImpersonationConfig>("ImpersonationConfig");
