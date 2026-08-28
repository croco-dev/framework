import { desc } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleSessionProvider } from "../libs/DrizzleSessionProvider";
import { sessions } from "../schema";

describe("DrizzleSessionProvider", () => {
  let provider!: DrizzleSessionProvider;
  let countWhereMock!: ReturnType<typeof vi.fn>;
  let mockDb!: {
    select: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    query: {
      sessions: {
        findFirst: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    countWhereMock = vi.fn().mockResolvedValue([{ total: 0 }]);
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ where: countWhereMock }),
      }),
      update: vi.fn(),
      query: {
        sessions: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
      },
    };

    provider = new DrizzleSessionProvider(
      mockDb as unknown as ConstructorParameters<typeof DrizzleSessionProvider>[0],
      { sessions },
    );
  });

  describe("getSession", () => {
    it("should return session when found", async () => {
      const mockSession = {
        id: "session-1",
        userId: "user-1",
        clientId: "client-1",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        expireAt: null,
        abandonedAt: null,
        lastActiveAt: null,
      };

      mockDb.query.sessions.findFirst.mockResolvedValue(mockSession);

      const result = await provider.getSession("session-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("session-1");
      expect(result?.userId).toBe("user-1");
    });

    it("should return null when session not found", async () => {
      mockDb.query.sessions.findFirst.mockResolvedValue(null);

      const result = await provider.getSession("non-existent");

      expect(result).toBeNull();
    });

    it("should return null when row validation fails", async () => {
      mockDb.query.sessions.findFirst.mockResolvedValue({ invalid: "data" });

      const result = await provider.getSession("session-1");

      expect(result).toBeNull();
    });

    it("should handle session with all optional fields", async () => {
      const mockSession = {
        id: "session-1",
        userId: "user-1",
        clientId: "client-1",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        expireAt: new Date(),
        abandonedAt: new Date(),
        lastActiveAt: new Date(),
      };

      mockDb.query.sessions.findFirst.mockResolvedValue(mockSession);

      const result = await provider.getSession("session-1");

      expect(result?.expireAt).toBeInstanceOf(Date);
      expect(result?.abandonedAt).toBeInstanceOf(Date);
      expect(result?.lastActiveAt).toBeInstanceOf(Date);
    });
  });

  describe("listSessions", () => {
    it("should return sessions with filters", async () => {
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-1",
          clientId: "client-1",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
          expireAt: null,
          abandonedAt: null,
          lastActiveAt: null,
        },
      ];

      mockDb.query.sessions.findMany.mockResolvedValue(mockSessions);
      countWhereMock.mockResolvedValue([{ total: 1 }]);

      const result = await provider.listSessions({ userId: "user-1", status: "active" });

      expect(result.sessions).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });

    it("should return empty array when no sessions match", async () => {
      mockDb.query.sessions.findMany.mockResolvedValue([]);

      const result = await provider.listSessions({ userId: "user-1" });

      expect(result.sessions).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it("should filter by userId", async () => {
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-1",
          clientId: "client-1",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
          expireAt: null,
          abandonedAt: null,
          lastActiveAt: null,
        },
      ];

      mockDb.query.sessions.findMany.mockResolvedValue(mockSessions);

      const result = await provider.listSessions({ userId: "user-1" });

      expect(result.sessions).toHaveLength(1);
      expect(mockDb.query.sessions.findMany).toHaveBeenCalled();
    });

    it("should filter by clientId", async () => {
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-1",
          clientId: "client-1",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
          expireAt: null,
          abandonedAt: null,
          lastActiveAt: null,
        },
      ];

      mockDb.query.sessions.findMany.mockResolvedValue(mockSessions);

      const result = await provider.listSessions({ clientId: "client-1" });

      expect(result.sessions).toHaveLength(1);
    });

    it("should filter by status", async () => {
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-1",
          clientId: "client-1",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
          expireAt: null,
          abandonedAt: null,
          lastActiveAt: null,
        },
      ];

      mockDb.query.sessions.findMany.mockResolvedValue(mockSessions);

      const result = await provider.listSessions({ status: "active" });

      expect(result.sessions).toHaveLength(1);
    });

    it("should support pagination", async () => {
      mockDb.query.sessions.findMany.mockResolvedValue([]);

      await provider.listSessions({ limit: 10, offset: 20 });

      expect(mockDb.query.sessions.findMany).toHaveBeenCalledWith({
        where: undefined,
        limit: 10,
        offset: 20,
        orderBy: expect.any(Array),
      });
    });

    it("should return the full matching count for a partial page", async () => {
      mockDb.query.sessions.findMany.mockResolvedValue([
        {
          id: "session-2",
          userId: "user-1",
          clientId: "client-1",
          status: "active",
          createdAt: new Date("2026-01-02T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
        },
      ]);
      countWhereMock.mockResolvedValue([{ total: 3 }]);

      const result = await provider.listSessions({ userId: "user-1", limit: 1, offset: 1 });

      expect(result.sessions).toHaveLength(1);
      expect(result.totalCount).toBe(3);
    });

    it("should retain the full matching count for an empty out-of-range page", async () => {
      mockDb.query.sessions.findMany.mockResolvedValue([]);
      countWhereMock.mockResolvedValue([{ total: 3 }]);

      const result = await provider.listSessions({ userId: "user-1", limit: 1, offset: 10 });

      expect(result).toEqual({ sessions: [], totalCount: 3 });
    });

    it("should reject a missing count aggregate row", async () => {
      mockDb.query.sessions.findMany.mockResolvedValue([]);
      countWhereMock.mockResolvedValue([]);

      await expect(provider.listSessions({})).rejects.toMatchObject({
        code: "auth-core/auth-provider-unavailable",
        detail: "Session count query did not return an aggregate row",
      });
    });

    it("should use the same filters for page rows and total count", async () => {
      mockDb.query.sessions.findMany.mockResolvedValue([]);

      await provider.listSessions({
        userId: "user-1",
        clientId: "client-1",
        status: "active",
      });

      const findManyArgs = mockDb.query.sessions.findMany.mock.calls[0]?.[0];
      expect(findManyArgs?.where).toBeDefined();
      expect(countWhereMock).toHaveBeenCalledWith(findManyArgs?.where);
    });

    it("should order sessions by a stable unique tuple", async () => {
      mockDb.query.sessions.findMany.mockResolvedValue([]);

      await provider.listSessions({});

      const findManyArgs = mockDb.query.sessions.findMany.mock.calls[0]?.[0];
      expect(findManyArgs?.orderBy).toEqual([desc(sessions.createdAt), desc(sessions.id)]);
    });

    it("should filter out invalid rows", async () => {
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-1",
          clientId: "client-1",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { invalid: "data" },
      ];

      mockDb.query.sessions.findMany.mockResolvedValue(mockSessions);

      const result = await provider.listSessions({});

      expect(result.sessions).toHaveLength(1);
    });
  });

  describe("revokeSession", () => {
    it("should revoke session", async () => {
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDb.update.mockReturnValue({ set: setMock });

      await provider.revokeSession("session-1");

      expect(mockDb.update).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith({ status: "revoked", updatedAt: expect.any(Date) });
    });
  });

  describe("revokeAllSessions", () => {
    it("should revoke all active sessions for user", async () => {
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDb.update.mockReturnValue({ set: setMock });

      await provider.revokeAllSessions("user-1");

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should handle condition when and() returns undefined", async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await provider.revokeAllSessions("user-1");

      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
