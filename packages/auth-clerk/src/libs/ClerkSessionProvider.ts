import { type ClerkClient, createClerkClient } from "@clerk/backend";
import type {
  Session,
  SessionListOptions,
  SessionListResult,
  SessionProvider,
} from "@croco/auth-core";
import type { ClerkAuthOptions } from "./ClerkAuthProvider";
import { executeClerkLookup, executeClerkOperation } from "./clerkOperation";
import { ClerkExternalServiceProblem } from "./problems/ClerkProblems";

const REVOKE_ALL_SESSIONS_PAGE_SIZE = 100;

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
    const clerkSession = await executeClerkLookup("sessions.getSession", () =>
      this.clerkClient.sessions.getSession(sessionId),
    );
    if (clerkSession === null) {
      return null;
    }

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

    const response = await executeClerkOperation("sessions.getSessionList", () =>
      this.clerkClient.sessions.getSessionList(params),
    );

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
    await executeClerkOperation("sessions.revokeSession", () =>
      this.clerkClient.sessions.revokeSession(sessionId),
    );
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const sessionIds = new Set<string>();
    let offset = 0;
    let hasRemainingSessions = true;

    while (hasRemainingSessions) {
      const { sessions, totalCount } = await this.listSessions({
        userId,
        limit: REVOKE_ALL_SESSIONS_PAGE_SIZE,
        offset,
      });

      if (sessions.length === 0 && offset < totalCount) {
        throw new ClerkExternalServiceProblem(
          "Clerk session pagination ended before all sessions were returned",
          {
            extensions: {
              operation: "sessions.getSessionList",
              provider: "clerk",
              retryable: true,
            },
          },
        );
      }

      for (const session of sessions) {
        sessionIds.add(session.id);
      }
      offset += sessions.length;
      hasRemainingSessions = offset < totalCount;
    }

    for (const sessionId of sessionIds) {
      await this.revokeSession(sessionId);
    }
  }
}
