import { ForbiddenProblem, UnauthorizedProblem } from "@croco/auth-core";
import type { ILogger } from "@croco/framework-context";
import { BetterAuthAuthenticationProblem } from "./problems/BetterAuthAuthenticationProblem";
import {
  BetterAuthSessionNotFoundProblem,
  BetterAuthUserNotFoundProblem,
} from "./problems/AuthProblems";
import { BetterAuthSessionLookupProblem } from "./problems/BetterAuthSessionLookupProblem";
import type { BetterAuthSession, BetterAuthSessionProvider } from "./types";

type BetterAuthContext = Promise<{
  internalAdapter: {
    findSession: (token: string) => Promise<unknown>;
    findUserById: (userId: string) => Promise<unknown>;
  };
}>;

/**
 * Better Auth 세션 목록 조회와 세션 해제를 제공하는 매니저입니다.
 */
export class BetterAuthSessionManager implements BetterAuthSessionProvider {
  constructor(
    private readonly factory: {
      getAuth: () => {
        $context: BetterAuthContext;
        api: {
          listSessions: (args: { headers: Headers }) => Promise<unknown>;
          revokeSession: (args: { headers: Headers; body: { token: string } }) => Promise<unknown>;
          revokeUserSessions: (args: {
            headers: Headers;
            body: { userId: string };
          }) => Promise<unknown>;
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

  async revokeSession(
    targetSessionToken: string,
    authorizationSessionToken: string,
  ): Promise<void> {
    if (typeof targetSessionToken !== "string" || !targetSessionToken.trim()) {
      throw new BetterAuthSessionNotFoundProblem("[Redacted]");
    }

    const headers = createAuthorizationHeaders(authorizationSessionToken);
    const auth = this.factory.getAuth();
    const ownership = await sessionOwnershipMatches(
      auth.$context,
      targetSessionToken,
      authorizationSessionToken,
    ).then(
      (matches) => ({ matches }) as const,
      (error: unknown) => ({ error }) as const,
    );

    try {
      await auth.api.revokeSession({
        headers,
        body: { token: targetSessionToken },
      });

      if ("error" in ownership) {
        throw ownership.error;
      }

      if (!ownership.matches) {
        throw new BetterAuthSessionNotFoundProblem("[Redacted]");
      }
    } catch (error) {
      if (
        error instanceof BetterAuthSessionNotFoundProblem ||
        error instanceof BetterAuthAuthenticationProblem
      ) {
        throw error;
      }

      throw mapRevocationError(
        error,
        "revokeSession",
        () => new BetterAuthSessionNotFoundProblem("[Redacted]"),
      );
    }
  }

  async revokeUserSessions(userId: string, adminSessionToken: string): Promise<void> {
    const headers = createAuthorizationHeaders(adminSessionToken);
    const auth = this.factory.getAuth();
    const targetUser = await userExists(auth.$context, userId).then(
      (exists) => ({ exists }) as const,
      (error: unknown) => ({ error }) as const,
    );

    try {
      await auth.api.revokeUserSessions({
        headers,
        body: { userId },
      });

      if ("error" in targetUser) {
        throw targetUser.error;
      }

      if (!targetUser.exists) {
        throw new BetterAuthUserNotFoundProblem(userId);
      }
    } catch (error) {
      if (
        error instanceof BetterAuthUserNotFoundProblem ||
        error instanceof BetterAuthAuthenticationProblem
      ) {
        throw error;
      }

      throw mapRevocationError(
        error,
        "revokeUserSessions",
        () => new BetterAuthUserNotFoundProblem(userId),
      );
    }
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

async function sessionOwnershipMatches(
  context: BetterAuthContext,
  targetSessionToken: string,
  authorizationSessionToken: string,
): Promise<boolean> {
  const { internalAdapter } = await context;
  const [targetSession, authorizationSession] = await Promise.all([
    internalAdapter.findSession(targetSessionToken),
    internalAdapter.findSession(authorizationSessionToken),
  ]);

  const targetUserId = getSessionUserId(targetSession);
  const authorizationUserId = getSessionUserId(authorizationSession);
  return targetUserId !== null && targetUserId === authorizationUserId;
}

async function userExists(context: BetterAuthContext, userId: string): Promise<boolean> {
  const user = await (await context).internalAdapter.findUserById(userId);
  if (user === null || user === undefined) {
    return false;
  }

  if (!isRecord(user)) {
    throw new BetterAuthAuthenticationProblem("revokeUserSessions", undefined);
  }

  return true;
}

function getSessionUserId(sessionResult: unknown): string | null {
  if (sessionResult === null || sessionResult === undefined) {
    return null;
  }

  if (!isRecord(sessionResult) || !isRecord(sessionResult.session)) {
    throw new BetterAuthAuthenticationProblem("revokeSession", undefined);
  }

  const userId = sessionResult.session.userId;
  if (typeof userId !== "string" || !userId) {
    throw new BetterAuthAuthenticationProblem("revokeSession", undefined);
  }

  return userId;
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

function createAuthorizationHeaders(sessionToken: string): Headers {
  if (typeof sessionToken !== "string" || !sessionToken.trim()) {
    throw new UnauthorizedProblem("Better Auth session authorization requires a session token");
  }

  return new Headers({ authorization: `Bearer ${sessionToken}` });
}

function mapRevocationError(
  error: unknown,
  operation: "revokeSession" | "revokeUserSessions",
  createNotFoundProblem: () => BetterAuthSessionNotFoundProblem | BetterAuthUserNotFoundProblem,
): Error {
  const statusCode = getNumericProperty(error, "statusCode") ?? getNumericProperty(error, "status");
  const status = getStringProperty(error, "status");

  if (statusCode === 401 || status === "UNAUTHORIZED") {
    return new UnauthorizedProblem("Better Auth session authorization failed");
  }

  if (statusCode === 403 || status === "FORBIDDEN") {
    return new ForbiddenProblem("Better Auth session authorization was denied");
  }

  if (statusCode === 404 || status === "NOT_FOUND") {
    return createNotFoundProblem();
  }

  return new BetterAuthAuthenticationProblem(operation, error);
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
