import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleSessionProvider } from "../libs/DrizzleSessionProvider";
import type { sessions as sessionsSchema } from "../schema";

describe("DrizzleSessionProvider", () => {
  let provider!: DrizzleSessionProvider;
  let mockDb!: {
    update: ReturnType<typeof vi.fn>;
    query: {
      sessions: {
        findFirst: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    mockDb = {
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
      {
        sessions: {} as typeof sessionsSchema,
      },
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
      });
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
