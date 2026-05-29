import { type ClerkClient, createClerkClient } from "@clerk/backend";
import type {
  Session,
  SessionListOptions,
  SessionListResult,
  SessionProvider,
} from "@croco/auth-core";
import type { ClerkAuthOptions } from "./ClerkAuthProvider";
import { ClerkExternalServiceProblem } from "./problems/ClerkProblems";

function mapClerkSessionStatus(status: string): Session["status"] {
  const validStatuses: Session["status"][] = [
    "abandoned",
    "active",
    "pending",
    "ended",
    "expired",
    "removed",
    "replaced",
    "revoked",
  ];
  if (validStatuses.includes(status as Session["status"])) {
    return status as Session["status"];
  }
  return "ended";
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getClerkErrorStatus(error: unknown): number | undefined {
  if (!isObjectRecord(error)) {
    return undefined;
  }

  const status = error.status;
  if (typeof status === "number") {
    return status;
  }

  const statusCode = error.statusCode;
  return typeof statusCode === "number" ? statusCode : undefined;
}

function timestampToDate(timestamp: number | undefined): Date | undefined {
  return timestamp ? new Date(timestamp) : undefined;
}

export class ClerkSessionProvider implements SessionProvider {
  private clerkClient: ClerkClient;

  constructor(options: ClerkAuthOptions) {
    this.clerkClient = createClerkClient({
      secretKey: options.secretKey,
      publishableKey: options.publishableKey,
    });
  }

  async getSession(sessionId: string): Promise<Session | null> {
    try {
      const clerkSession = await this.clerkClient.sessions.getSession(sessionId);

      return {
        id: clerkSession.id,
        userId: clerkSession.userId,
        clientId: clerkSession.clientId,
        status: mapClerkSessionStatus(clerkSession.status),
        createdAt: new Date(clerkSession.createdAt),
        updatedAt: new Date(clerkSession.updatedAt),
        expireAt: timestampToDate(clerkSession.expireAt),
        abandonedAt: timestampToDate(clerkSession.abandonAt),
        lastActiveAt: timestampToDate(clerkSession.lastActiveAt),
      };
    } catch (error: unknown) {
      const status = getClerkErrorStatus(error);
      if (status === 404) {
        return null; // 세션 미존재 — 정상
      }

      throw new ClerkExternalServiceProblem("Failed to get session from Clerk", {
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  async listSessions(options: SessionListOptions): Promise<SessionListResult> {
    const params: Record<string, string | number> = {};

    if (options.userId) {
      params.userId = options.userId;
    }
    if (options.clientId) {
      params.clientId = options.clientId;
    }
    if (options.status) {
      params.status = options.status;
    }
    if (options.limit !== undefined) {
      params.limit = options.limit;
    }
    if (options.offset !== undefined) {
      params.offset = options.offset;
    }

    const response = await this.clerkClient.sessions.getSessionList(params);

    const sessions: Session[] = response.data.map((clerkSession) => ({
      id: clerkSession.id,
      userId: clerkSession.userId,
      clientId: clerkSession.clientId,
      status: mapClerkSessionStatus(clerkSession.status),
      createdAt: new Date(clerkSession.createdAt),
      updatedAt: new Date(clerkSession.updatedAt),
      expireAt: timestampToDate(clerkSession.expireAt),
      abandonedAt: timestampToDate(clerkSession.abandonAt),
      lastActiveAt: timestampToDate(clerkSession.lastActiveAt),
    }));

    return {
      sessions,
      totalCount: response.totalCount,
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.clerkClient.sessions.revokeSession(sessionId);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const { sessions } = await this.listSessions({ userId });
    for (const session of sessions) {
      await this.clerkClient.sessions.revokeSession(session.id);
    }
  }
}
