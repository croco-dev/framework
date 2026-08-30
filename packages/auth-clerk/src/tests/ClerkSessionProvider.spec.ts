import { createClerkClient } from "@clerk/backend";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClerkSessionProvider } from "../libs/ClerkSessionProvider";
import { ClerkExternalServiceProblem } from "../libs/problems/ClerkProblems";

vi.mock("@clerk/backend", () => ({
  createClerkClient: vi.fn(),
}));

describe("ClerkSessionProvider", () => {
  let provider!: ClerkSessionProvider;
  let mockClerkClient!: ReturnType<typeof createClerkClient>;

  const options = { secretKey: "sk_test_123", publishableKey: "pk_test_123" };

  beforeEach(() => {
    vi.clearAllMocks();

    mockClerkClient = {
      sessions: {
        getSession: vi.fn(),
        getSessionList: vi.fn(),
        revokeSession: vi.fn(),
      },
      users: {},
    } as unknown as ReturnType<typeof createClerkClient>;

    vi.mocked(createClerkClient).mockReturnValue(mockClerkClient);
    provider = new ClerkSessionProvider(options);
  });

  describe("getSession", () => {
    it("should return session on success", async () => {
      const mockSession = {
        id: "sess_123",
        userId: "user_123",
        clientId: "client_123",
        status: "active",
        createdAt: 1678886400000,
        updatedAt: 1678886500000,
        expireAt: 1678972800000,
        abandonAt: undefined,
        lastActiveAt: 1678886400000,
      };

      vi.mocked(mockClerkClient.sessions.getSession).mockResolvedValue(
        mockSession as unknown as Awaited<ReturnType<typeof mockClerkClient.sessions.getSession>>,
      );

      const result = await provider.getSession("sess_123");

      expect(result).toEqual({
        id: "sess_123",
        userId: "user_123",
        clientId: "client_123",
        status: "active",
        createdAt: new Date(1678886400000),
        updatedAt: new Date(1678886500000),
        expireAt: new Date(1678972800000),
        abandonedAt: undefined,
        lastActiveAt: new Date(1678886400000),
      });
    });

    it("should return null on 404", async () => {
      const clerkError = { status: 404, message: "Session not found" };
      vi.mocked(mockClerkClient.sessions.getSession).mockRejectedValue(clerkError);

      const result = await provider.getSession("invalid-sess");

      expect(result).toBeNull();
    });

    it("should throw ClerkExternalServiceProblem on network error", async () => {
      const networkError = new Error("Network connection failed");
      vi.mocked(mockClerkClient.sessions.getSession).mockRejectedValue(networkError);

      await expect(provider.getSession("sess_123")).rejects.toThrow(ClerkExternalServiceProblem);
    });

    it("should throw ClerkExternalServiceProblem on non-404 Clerk error", async () => {
      const clerkError = { status: 500, message: "Internal server error" };
      vi.mocked(mockClerkClient.sessions.getSession).mockRejectedValue(clerkError);

      await expect(provider.getSession("sess_123")).rejects.toThrow(ClerkExternalServiceProblem);
    });
  });

  describe("listSessions", () => {
    it("should return list of sessions", async () => {
      const mockSessions = [
        {
          id: "sess_1",
          userId: "user_123",
          clientId: "client_1",
          status: "active",
          createdAt: 1678886400000,
          updatedAt: 1678886400000,
        },
      ];

      const mockResponse = {
        data: mockSessions,
        totalCount: 1,
      };
      vi.mocked(mockClerkClient.sessions.getSessionList).mockResolvedValue(
        mockResponse as unknown as Awaited<
          ReturnType<typeof mockClerkClient.sessions.getSessionList>
        >,
      );

      const result = await provider.listSessions({ userId: "user_123" });

      expect(result.sessions).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(mockClerkClient.sessions.getSessionList).toHaveBeenCalledWith({
        userId: "user_123",
      });
    });

    it("should pass all options to API", async () => {
      const mockResponse = {
        data: [],
        totalCount: 0,
      };
      vi.mocked(mockClerkClient.sessions.getSessionList).mockResolvedValue(
        mockResponse as unknown as Awaited<
          ReturnType<typeof mockClerkClient.sessions.getSessionList>
        >,
      );

      await provider.listSessions({
        userId: "user_123",
        status: "active",
        limit: 10,
        offset: 5,
      });

      expect(mockClerkClient.sessions.getSessionList).toHaveBeenCalledWith({
        userId: "user_123",
        status: "active",
        limit: 10,
        offset: 5,
      });
    });
  });

  describe("revokeSession", () => {
    it("should call revokeSession", async () => {
      vi.mocked(mockClerkClient.sessions.revokeSession).mockResolvedValue(
        {} as unknown as Awaited<ReturnType<typeof mockClerkClient.sessions.revokeSession>>,
      );

      await provider.revokeSession("sess_123");

      expect(mockClerkClient.sessions.revokeSession).toHaveBeenCalledWith("sess_123");
    });

    it("should classify retryable mutation failures without exposing SDK details", async () => {
      vi.mocked(mockClerkClient.sessions.revokeSession).mockRejectedValue(
        new Error("ECONNRESET credential=sk_test_leaked"),
      );

      await expect(provider.revokeSession("sess_123")).rejects.toMatchObject({
        code: "auth-clerk/external-service-error",
        detail: "Clerk operation 'sessions.revokeSession' failed",
        extensions: {
          operation: "sessions.revokeSession",
          provider: "clerk",
          retryable: true,
        },
      });
    });
  });

  describe("revokeAllSessions", () => {
    it("should revoke all sessions for user", async () => {
      const mockResponse = {
        data: [{ id: "sess_1" }, { id: "sess_2" }],
        totalCount: 2,
      };
      vi.mocked(mockClerkClient.sessions.getSessionList).mockResolvedValue(
        mockResponse as unknown as Awaited<
          ReturnType<typeof mockClerkClient.sessions.getSessionList>
        >,
      );

      vi.mocked(mockClerkClient.sessions.revokeSession).mockResolvedValue(
        {} as unknown as Awaited<ReturnType<typeof mockClerkClient.sessions.revokeSession>>,
      );

      await provider.revokeAllSessions("user_123");

      expect(mockClerkClient.sessions.revokeSession).toHaveBeenCalledWith("sess_1");
      expect(mockClerkClient.sessions.revokeSession).toHaveBeenCalledWith("sess_2");
    });
  });
});
