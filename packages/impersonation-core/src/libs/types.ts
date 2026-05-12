import { Token } from "@croco/framework-context";

export type ImpersonationState = {
  sessionId: string;
  impersonatorId: string;
  targetUserId: string;
  reason?: string;
  startedAt: Date;
  expiresAt: Date;
};

export type ImpersonationConfig = {
  maxDurationMs: number;
  requireReason: boolean;
  blockedActions: string[];
};

export const IMPERSONATION_CONFIG_TOKEN = new Token<ImpersonationConfig>("ImpersonationConfig");
