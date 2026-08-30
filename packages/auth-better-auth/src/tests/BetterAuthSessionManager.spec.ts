import "reflect-metadata";
import { ForbiddenProblem, UnauthorizedProblem } from "@croco/auth-core";
import type { ILogger } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BetterAuthSessionManager } from "../libs/BetterAuthSessionManager";
import { BetterAuthAuthenticationProblem } from "../libs/problems/BetterAuthAuthenticationProblem";
import {
  BetterAuthSessionNotFoundProblem,
  BetterAuthUserNotFoundProblem,
} from "../libs/problems/AuthProblems";
import { BetterAuthSessionLookupProblem } from "../libs/problems/BetterAuthSessionLookupProblem";

function createMockAuthFactory(
  options: {
    sessions?: unknown;
    listSessionsError?: unknown;
    getUserError?: unknown;
    revokeSessionError?: unknown;
    revokeUserSessionsError?: unknown;
  } = {},
) {
  const {
    sessions = [{ token: "session-token-123" }],
    listSessionsError,
    getUserError,
    revokeSessionError,
    revokeUserSessionsError,
  } = options;
  const listSessions = vi.fn<(args: { headers: Headers }) => Promise<unknown>>();
  const getUser = vi.fn<(args: { headers: Headers; query: { id: string } }) => Promise<unknown>>();
  const revokeSession =
    vi.fn<(args: { headers: Headers; body: { token: string } }) => Promise<void>>();
  const revokeUserSessions =
    vi.fn<(args: { headers: Headers; body: { userId: string } }) => Promise<void>>();

  if (listSessionsError === undefined) {
    listSessions.mockResolvedValue(sessions);
  } else {
    listSessions.mockRejectedValue(listSessionsError);
  }

  if (getUserError === undefined) {
    getUser.mockResolvedValue({ id: "user-123" });
  } else {
    getUser.mockRejectedValue(getUserError);
  }

  if (revokeSessionError === undefined) {
    revokeSession.mockResolvedValue(undefined);
  } else {
    revokeSession.mockRejectedValue(revokeSessionError);
  }

  if (revokeUserSessionsError === undefined) {
    revokeUserSessions.mockResolvedValue(undefined);
  } else {
    revokeUserSessions.mockRejectedValue(revokeUserSessionsError);
  }

  return {
    getAuth: () => ({
      api: {
        listSessions,
        revokeSession,
        getUser,
        revokeUserSessions,
      },
    }),
  };
}

describe("BetterAuthSessionManager", () => {
  let mockFactory!: ReturnType<typeof createMockAuthFactory>;
  let sessionManager!: BetterAuthSessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFactory = createMockAuthFactory();
    sessionManager = new BetterAuthSessionManager(mockFactory);
  });

  describe("getSession", () => {
    it("should return session when token matches", async () => {
      const mockSessions = [
        {
          id: "session-123",
          token: "valid-token",
          userId: "user-456",
          expiresAt: new Date("2025-12-31"),
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-01"),
          ipAddress: "127.0.0.1",
          userAgent: "TestAgent/1.0",
        },
      ];

      mockFactory = createMockAuthFactory({ sessions: mockSessions });
      sessionManager = new BetterAuthSessionManager(mockFactory);

      const result = await sessionManager.getSession("valid-token");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("session-123");
      expect(result?.token).toBe("valid-token");
      expect(result?.userId).toBe("user-456");
    });

    it("should return null when session not found", async () => {
      const mockSessions = [
        {
          id: "session-123",
          token: "other-token",
          userId: "user-456",
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFactory = createMockAuthFactory({ sessions: mockSessions });
      sessionManager = new BetterAuthSessionManager(mockFactory);

      const result = await sessionManager.getSession("non-existent-token");

      expect(result).toBeNull();
    });

    it("should return null when sessions is null", async () => {
      mockFactory = createMockAuthFactory({ sessions: null });
      sessionManager = new BetterAuthSessionManager(mockFactory);

      const result = await sessionManager.getSession("any-token");

      expect(result).toBeNull();
    });

    it("should return null when sessions is not an array", async () => {
      mockFactory = createMockAuthFactory({ sessions: {} });
      sessionManager = new BetterAuthSessionManager(mockFactory);

      const result = await sessionManager.getSession("any-token");

      expect(result).toBeNull();
    });

    it("should handle session with string dates", async () => {
      const mockSessions = [
        {
          id: "session-123",
          token: "valid-token",
          userId: "user-456",
          expiresAt: "2025-12-31T00:00:00Z",
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
        },
      ];

      mockFactory = createMockAuthFactory({ sessions: mockSessions });
      sessionManager = new BetterAuthSessionManager(mockFactory);

      const result = await sessionManager.getSession("valid-token");

      expect(result).not.toBeNull();
      expect(result?.expiresAt instanceof Date).toBe(true);
      expect(result?.createdAt instanceof Date).toBe(true);
      expect(result?.updatedAt instanceof Date).toBe(true);
    });

    it("should handle missing optional fields", async () => {
      const mockSessions = [
        {
          id: "session-123",
          token: "valid-token",
          userId: "user-456",
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFactory = createMockAuthFactory({ sessions: mockSessions });
      sessionManager = new BetterAuthSessionManager(mockFactory);

      const result = await sessionManager.getSession("valid-token");

      expect(result).not.toBeNull();
      expect(result?.ipAddress).toBeUndefined();
      expect(result?.userAgent).toBeUndefined();
    });

    it("should return null when listSessions rejects invalid session errors", async () => {
      const errorFactory = {
        getAuth: () => ({
          api: {
            listSessions: vi
              .fn<(args: { headers: Headers }) => Promise<unknown[]>>()
              .mockRejectedValue({ statusCode: 401 }),
            revokeSession: vi
              .fn<(args: { headers: Headers; body: { token: string } }) => Promise<void>>()
              .mockResolvedValue(undefined),
            getUser: vi
              .fn<(args: { headers: Headers; query: { id: string } }) => Promise<unknown>>()
              .mockResolvedValue({ id: "user-123" }),
            revokeUserSessions: vi
              .fn<(args: { headers: Headers; body: { userId: string } }) => Promise<void>>()
              .mockResolvedValue(undefined),
          },
        }),
      };

      sessionManager = new BetterAuthSessionManager(errorFactory);

      const result = await sessionManager.getSession("expired-token");

      expect(result).toBeNull();
    });

    it("should throw lookup problem and log warning when listSessions fails unexpectedly", async () => {
      const warnSpy = vi.fn();
      const logger: ILogger = {
        warn: warnSpy,
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        child: vi.fn(),
      };
      const errorFactory = {
        getAuth: () => ({
          api: {
            listSessions: vi
              .fn<(args: { headers: Headers }) => Promise<unknown[]>>()
              .mockRejectedValue(new Error("Network error")),
            revokeSession: vi
              .fn<(args: { headers: Headers; body: { token: string } }) => Promise<void>>()
              .mockResolvedValue(undefined),
            getUser: vi
              .fn<(args: { headers: Headers; query: { id: string } }) => Promise<unknown>>()
              .mockResolvedValue({ id: "user-123" }),
            revokeUserSessions: vi
              .fn<(args: { headers: Headers; body: { userId: string } }) => Promise<void>>()
              .mockResolvedValue(undefined),
          },
        }),
      };

      sessionManager = new BetterAuthSessionManager(errorFactory, logger);

      await expect(sessionManager.getSession("any-token")).rejects.toBeInstanceOf(
        BetterAuthSessionLookupProblem,
      );

      expect(warnSpy).toHaveBeenCalledWith("BetterAuthSessionManager.getSession() failed", {
        error: expect.any(Error),
      });
    });

    it("should throw lookup problem for 5xx lookup errors", async () => {
      const errorFactory = {
        getAuth: () => ({
          api: {
            listSessions: vi
              .fn<(args: { headers: Headers }) => Promise<unknown[]>>()
              .mockRejectedValue({ status: 503 }),
            revokeSession: vi
              .fn<(args: { headers: Headers; body: { token: string } }) => Promise<void>>()
              .mockResolvedValue(undefined),
            getUser: vi
              .fn<(args: { headers: Headers; query: { id: string } }) => Promise<unknown>>()
              .mockResolvedValue({ id: "user-123" }),
            revokeUserSessions: vi
              .fn<(args: { headers: Headers; body: { userId: string } }) => Promise<void>>()
              .mockResolvedValue(undefined),
          },
        }),
      };

      sessionManager = new BetterAuthSessionManager(errorFactory);

      await expect(sessionManager.getSession("any-token")).rejects.toBeInstanceOf(
        BetterAuthSessionLookupProblem,
      );
    });
  });

  describe("revokeSession", () => {
    it("should revoke session successfully", async () => {
      const revokeSpy = vi
        .fn<(args: { headers: Headers; body: { token: string } }) => Promise<void>>()
        .mockResolvedValue(undefined);
      mockFactory = {
        getAuth: () => ({
          api: {
            listSessions: vi
              .fn<(args: { headers: Headers }) => Promise<unknown[]>>()
              .mockResolvedValue([{ token: "target-session-token" }]),
            revokeSession: revokeSpy,
            getUser: vi
              .fn<(args: { headers: Headers; query: { id: string } }) => Promise<unknown>>()
              .mockResolvedValue({ id: "user-123" }),
            revokeUserSessions: vi
              .fn<(args: { headers: Headers; body: { userId: string } }) => Promise<void>>()
              .mockResolvedValue(undefined),
          },
        }),
      };
      sessionManager = new BetterAuthSessionManager(mockFactory);

      await sessionManager.revokeSession("target-session-token", "authorization-session-token");

      expect(revokeSpy).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        body: { token: "target-session-token" },
      });
      const call = revokeSpy.mock.calls[0]?.[0];
      expect(call?.headers.get("authorization")).toBe("Bearer authorization-session-token");
    });

    it("should preserve authorization failures instead of reporting a missing session", async () => {
      mockFactory = createMockAuthFactory({
        revokeSessionError: { status: "UNAUTHORIZED", statusCode: 401 },
      });
      sessionManager = new BetterAuthSessionManager(mockFactory);

      const revocation = sessionManager.revokeSession(
        "session-token-123",
        "authorization-session-token",
      );

      await expect(revocation).rejects.toBeInstanceOf(UnauthorizedProblem);
      await expect(revocation).rejects.not.toBeInstanceOf(BetterAuthSessionNotFoundProblem);
    });

    it("should map a missing target session to BetterAuthSessionNotFoundProblem", async () => {
      mockFactory = createMockAuthFactory({ sessions: [] });
      sessionManager = new BetterAuthSessionManager(mockFactory);

      await expect(
        sessionManager.revokeSession("missing-session", "authorization-session-token"),
      ).rejects.toMatchObject({
        code: "auth-better-auth/session-not-found",
        detail: "Session with id '[Redacted]' not found",
      });
      expect(mockFactory.getAuth().api.revokeSession).not.toHaveBeenCalled();
    });

    it("should reject an empty authorization session token before calling Better Auth", async () => {
      await expect(sessionManager.revokeSession("session-token-123", " ")).rejects.toBeInstanceOf(
        UnauthorizedProblem,
      );
    });

    it.each([
      "upstream echoed session-token-123",
      "authorization: Bearer authorization-session-token",
    ])("should keep revoke credentials out of unexpected failure details: %s", async (message) => {
      mockFactory = createMockAuthFactory({
        revokeSessionError: {
          statusCode: 503,
          message,
        },
      });
      sessionManager = new BetterAuthSessionManager(mockFactory);

      const revocation = sessionManager.revokeSession(
        "session-token-123",
        "authorization-session-token",
      );

      await expect(revocation).rejects.toBeInstanceOf(BetterAuthAuthenticationProblem);
      await expect(revocation).rejects.toMatchObject({
        code: "auth-better-auth/authentication-failed",
        detail: "Better Auth revokeSession failed: upstream revocation failed",
        extensions: {
          operation: "revokeSession",
          provider: "better-auth",
          retryable: true,
          upstreamStatus: 503,
        },
      });
    });
  });

  describe("revokeUserSessions", () => {
    it("should revoke all user sessions", async () => {
      const revokeUserSpy = vi
        .fn<(args: { headers: Headers; body: { userId: string } }) => Promise<void>>()
        .mockResolvedValue(undefined);
      mockFactory = {
        getAuth: () => ({
          api: {
            listSessions: vi
              .fn<(args: { headers: Headers }) => Promise<unknown[]>>()
              .mockResolvedValue([] as unknown[]),
            revokeSession: vi
              .fn<(args: { headers: Headers; body: { token: string } }) => Promise<void>>()
              .mockResolvedValue(undefined),
            getUser: vi
              .fn<(args: { headers: Headers; query: { id: string } }) => Promise<unknown>>()
              .mockResolvedValue({ id: "user-123" }),
            revokeUserSessions: revokeUserSpy,
          },
        }),
      };
      sessionManager = new BetterAuthSessionManager(mockFactory);

      await sessionManager.revokeUserSessions("user-123", "admin-session-token");

      expect(revokeUserSpy).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        body: { userId: "user-123" },
      });
      const call = revokeUserSpy.mock.calls[0]?.[0];
      expect(call?.headers.get("authorization")).toBe("Bearer admin-session-token");
    });

    it("should preserve admin authorization failures", async () => {
      mockFactory = createMockAuthFactory({
        revokeUserSessionsError: { status: "UNAUTHORIZED", statusCode: 401 },
      });
      sessionManager = new BetterAuthSessionManager(mockFactory);

      await expect(
        sessionManager.revokeUserSessions("user-123", "invalid-admin-session"),
      ).rejects.toBeInstanceOf(UnauthorizedProblem);
    });

    it("should preserve admin permission failures", async () => {
      mockFactory = createMockAuthFactory({
        revokeUserSessionsError: { status: "FORBIDDEN", statusCode: 403 },
      });
      sessionManager = new BetterAuthSessionManager(mockFactory);

      await expect(
        sessionManager.revokeUserSessions("user-123", "non-admin-session"),
      ).rejects.toBeInstanceOf(ForbiddenProblem);
    });

    it("should reject a missing admin session token", async () => {
      await expect(sessionManager.revokeUserSessions("user-123", "")).rejects.toBeInstanceOf(
        UnauthorizedProblem,
      );
    });

    it("should map a missing target user to BetterAuthUserNotFoundProblem", async () => {
      mockFactory = createMockAuthFactory({
        getUserError: { status: "NOT_FOUND", statusCode: 404 },
      });
      sessionManager = new BetterAuthSessionManager(mockFactory);

      await expect(
        sessionManager.revokeUserSessions("missing-user", "admin-session-token"),
      ).rejects.toBeInstanceOf(BetterAuthUserNotFoundProblem);
      expect(mockFactory.getAuth().api.revokeUserSessions).not.toHaveBeenCalled();
    });

    it.each(["upstream echoed admin-session-token", "authorization: Bearer admin-session-token"])(
      "should keep admin credentials out of unexpected failure details: %s",
      async (message) => {
        mockFactory = createMockAuthFactory({
          revokeUserSessionsError: { statusCode: 503, message },
        });
        sessionManager = new BetterAuthSessionManager(mockFactory);

        await expect(
          sessionManager.revokeUserSessions("user-123", "admin-session-token"),
        ).rejects.toMatchObject({
          code: "auth-better-auth/authentication-failed",
          detail: "Better Auth revokeUserSessions failed: upstream revocation failed",
          extensions: {
            operation: "revokeUserSessions",
            provider: "better-auth",
            retryable: true,
            upstreamStatus: 503,
          },
        });
      },
    );
  });
});
