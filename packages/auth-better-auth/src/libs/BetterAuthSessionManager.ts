import { BetterAuthSessionNotFoundProblem } from "./problems/AuthProblems";
import type { BetterAuthSession, BetterAuthSessionProvider } from "./types";

/**
 * Better Auth 세션 목록 조회와 세션 해제를 제공하는 매니저입니다.
 */
export class BetterAuthSessionManager implements BetterAuthSessionProvider {
  constructor(
    private readonly factory: {
      getAuth: () => {
        api: {
          listSessions: (args: { headers: Headers }) => Promise<unknown[]>;
          revokeSession: (args: { headers: Headers; body: { token: string } }) => Promise<void>;
          revokeUserSessions: (args: {
            headers: Headers;
            body: { userId: string };
          }) => Promise<void>;
        };
      };
    },
  ) {}

  async getSession(token: string): Promise<BetterAuthSession | null> {
    const auth = this.factory.getAuth();

    try {
      const sessions = await auth.api.listSessions({
        headers: new Headers({ authorization: `Bearer ${token}` }),
      });

      if (!Array.isArray(sessions)) {
        return null;
      }

      const session = sessions.find((s: unknown) => isRecord(s) && s.token === token);

      if (!session || !isRecord(session)) {
        return null;
      }

      return this.mapToBetterAuthSession(session);
    } catch {
      return null;
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    const auth = this.factory.getAuth();

    try {
      await auth.api.revokeSession({
        headers: new Headers(),
        body: { token: sessionId },
      });
    } catch {
      throw new BetterAuthSessionNotFoundProblem(sessionId);
    }
  }

  async revokeUserSessions(userId: string): Promise<void> {
    const auth = this.factory.getAuth();

    await auth.api.revokeUserSessions({
      headers: new Headers(),
      body: { userId },
    });
  }

  private mapToBetterAuthSession(session: Record<string, unknown>): BetterAuthSession {
    return {
      id: String(session.id ?? ""),
      userId: String(session.userId ?? ""),
      expiresAt:
        session.expiresAt instanceof Date
          ? session.expiresAt
          : new Date(session.expiresAt as string),
      token: String(session.token ?? ""),
      createdAt:
        session.createdAt instanceof Date
          ? session.createdAt
          : new Date(session.createdAt as string),
      updatedAt:
        session.updatedAt instanceof Date
          ? session.updatedAt
          : new Date(session.updatedAt as string),
      ipAddress: typeof session.ipAddress === "string" ? session.ipAddress : undefined,
      userAgent: typeof session.userAgent === "string" ? session.userAgent : undefined,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
