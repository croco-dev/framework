import type { ILogger } from "@croco/framework-context";
import { BetterAuthSessionNotFoundProblem } from "./problems/AuthProblems";
import { BetterAuthSessionLookupProblem } from "./problems/BetterAuthSessionLookupProblem";
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
    private readonly logger?: ILogger,
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
    } catch (error) {
      if (isInvalidSessionLookupError(error)) {
        return null;
      }

      const cause = toError(error);
      this.logger?.warn("BetterAuthSessionManager.getSession() failed", { error: cause });
      throw new BetterAuthSessionLookupProblem(cause);
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

function isInvalidSessionLookupError(error: unknown): boolean {
  const statusCode = getNumericProperty(error, "statusCode") ?? getNumericProperty(error, "status");

  if (statusCode !== undefined) {
    return statusCode >= 400 && statusCode < 500;
  }

  const status = getStringProperty(error, "status");
  return (
    status === "UNAUTHORIZED" ||
    status === "FORBIDDEN" ||
    status === "NOT_FOUND" ||
    status === "BAD_REQUEST"
  );
}

function getNumericProperty(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const property = value[key];
  return typeof property === "number" ? property : undefined;
}

function getStringProperty(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const property = value[key];
  return typeof property === "string" ? property : undefined;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
