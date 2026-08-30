import "reflect-metadata";
import type { ILogger } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BetterAuthSessionManager } from "../libs/BetterAuthSessionManager";
import { BetterAuthSessionNotFoundProblem } from "../libs/problems/AuthProblems";
import { BetterAuthSessionLookupProblem } from "../libs/problems/BetterAuthSessionLookupProblem";

function createMockAuthFactory(sessions: unknown[] | null = [], revokeError = false) {
  return {
    getAuth: () => ({
      api: {
        listSessions: vi
          .fn<(args: { headers: Headers }) => Promise<unknown[]>>()
          .mockResolvedValue(sessions as unknown[]),
        revokeSession: revokeError
          ? vi
              .fn<(args: { headers: Headers; body: { token: string } }) => Promise<void>>()
              .mockRejectedValue(new Error("Session not found"))
          : vi
              .fn<(args: { headers: Headers; body: { token: string } }) => Promise<void>>()
              .mockResolvedValue(undefined),
        revokeUserSessions: vi
          .fn<(args: { headers: Headers; body: { userId: string } }) => Promise<void>>()
          .mockResolvedValue(undefined),
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

      mockFactory = createMockAuthFactory(mockSessions);
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

      mockFactory = createMockAuthFactory(mockSessions);
      sessionManager = new BetterAuthSessionManager(mockFactory);

      const result = await sessionManager.getSession("non-existent-token");

      expect(result).toBeNull();
    });

    it("should return null when sessions is null", async () => {
      mockFactory = createMockAuthFactory(null);
      sessionManager = new BetterAuthSessionManager(mockFactory);

      const result = await sessionManager.getSession("any-token");

      expect(result).toBeNull();
    });

    it("should return null when sessions is not an array", async () => {
      mockFactory = createMockAuthFactory({} as unknown[]);
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

      mockFactory = createMockAuthFactory(mockSessions);
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

      mockFactory = createMockAuthFactory(mockSessions);
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
              .mockResolvedValue([] as unknown[]),
            revokeSession: revokeSpy,
            revokeUserSessions: vi
              .fn<(args: { headers: Headers; body: { userId: string } }) => Promise<void>>()
              .mockResolvedValue(undefined),
          },
        }),
      };
      sessionManager = new BetterAuthSessionManager(mockFactory);

      await sessionManager.revokeSession("session-token-123");

      expect(revokeSpy).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        body: { token: "session-token-123" },
      });
    });

    it("should throw BetterAuthSessionNotFoundProblem when revoke fails", async () => {
      mockFactory = createMockAuthFactory([], true);
      sessionManager = new BetterAuthSessionManager(mockFactory);

      await expect(sessionManager.revokeSession("invalid-session")).rejects.toBeInstanceOf(
        BetterAuthSessionNotFoundProblem,
      );
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
            revokeUserSessions: revokeUserSpy,
          },
        }),
      };
      sessionManager = new BetterAuthSessionManager(mockFactory);

      await sessionManager.revokeUserSessions("user-123");

      expect(revokeUserSpy).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        body: { userId: "user-123" },
      });
    });
  });
});
