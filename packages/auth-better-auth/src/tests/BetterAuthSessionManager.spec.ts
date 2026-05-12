import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BetterAuthSessionManager } from "../libs/BetterAuthSessionManager";
import { BetterAuthSessionNotFoundProblem } from "../libs/problems/AuthProblems";

function createMockAuthFactory(sessions: unknown[] | null = [], revokeError = false) {
  return {
    getAuth: () => ({
      api: {
        listSessions: vi.fn().mockResolvedValue(sessions),
        revokeSession: revokeError
          ? vi.fn().mockRejectedValue(new Error("Session not found"))
          : vi.fn().mockResolvedValue(undefined),
        revokeUserSessions: vi.fn().mockResolvedValue(undefined),
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
    sessionManager = new BetterAuthSessionManager(
      mockFactory as unknown as {
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
    );
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
      sessionManager = new BetterAuthSessionManager(
        mockFactory as unknown as {
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
      );

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
      sessionManager = new BetterAuthSessionManager(
        mockFactory as unknown as {
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
      );

      const result = await sessionManager.getSession("non-existent-token");

      expect(result).toBeNull();
    });

    it("should return null when sessions is null", async () => {
      mockFactory = createMockAuthFactory(null);
      sessionManager = new BetterAuthSessionManager(
        mockFactory as unknown as {
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
      );

      const result = await sessionManager.getSession("any-token");

      expect(result).toBeNull();
    });

    it("should return null when sessions is not an array", async () => {
      mockFactory = createMockAuthFactory({} as unknown[]);
      sessionManager = new BetterAuthSessionManager(
        mockFactory as unknown as {
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
      );

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
      sessionManager = new BetterAuthSessionManager(
        mockFactory as unknown as {
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
      );

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
      sessionManager = new BetterAuthSessionManager(
        mockFactory as unknown as {
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
      );

      const result = await sessionManager.getSession("valid-token");

      expect(result).not.toBeNull();
      expect(result?.ipAddress).toBeUndefined();
      expect(result?.userAgent).toBeUndefined();
    });
  });

  describe("revokeSession", () => {
    it("should revoke session successfully", async () => {
      const revokeSpy = vi.fn().mockResolvedValue(undefined);
      mockFactory = {
        getAuth: () => ({
          api: {
            listSessions: vi.fn(),
            revokeSession: revokeSpy,
            revokeUserSessions: vi.fn(),
          },
        }),
      };
      sessionManager = new BetterAuthSessionManager(
        mockFactory as unknown as {
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
      );

      await sessionManager.revokeSession("session-token-123");

      expect(revokeSpy).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        body: { token: "session-token-123" },
      });
    });

    it("should throw BetterAuthSessionNotFoundProblem when revoke fails", async () => {
      mockFactory = createMockAuthFactory([], true);
      sessionManager = new BetterAuthSessionManager(
        mockFactory as unknown as {
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
      );

      await expect(sessionManager.revokeSession("invalid-session")).rejects.toBeInstanceOf(
        BetterAuthSessionNotFoundProblem,
      );
    });
  });

  describe("revokeUserSessions", () => {
    it("should revoke all user sessions", async () => {
      const revokeUserSpy = vi.fn().mockResolvedValue(undefined);
      mockFactory = {
        getAuth: () => ({
          api: {
            listSessions: vi.fn(),
            revokeSession: vi.fn(),
            revokeUserSessions: revokeUserSpy,
          },
        }),
      };
      sessionManager = new BetterAuthSessionManager(
        mockFactory as unknown as {
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
      );

      await sessionManager.revokeUserSessions("user-123");

      expect(revokeUserSpy).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        body: { userId: "user-123" },
      });
    });
  });
});
