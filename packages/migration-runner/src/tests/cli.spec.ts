import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("commander", () => {
  const mockCommand = {
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    command: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnThis(),
    parse: vi.fn(),
  };
  return {
    Command: vi.fn(function commandConstructor() {
      return mockCommand;
    }),
  };
});

const { mockPoolEnd, mockRunnerUp, mockRunnerDown, mockRunnerStatus } = vi.hoisted(() => ({
  mockPoolEnd: vi.fn().mockResolvedValue(undefined),
  mockRunnerUp: vi.fn().mockResolvedValue(["20240101000001_test"]),
  mockRunnerDown: vi.fn().mockResolvedValue(["20240101000001_test"]),
  mockRunnerStatus: vi.fn().mockResolvedValue([]),
}));

vi.mock("pg", () => ({
  Pool: vi.fn(function poolConstructor() {
    return { end: mockPoolEnd };
  }),
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn(() => ({})),
}));

vi.mock("../libs/MigrationRunner", () => ({
  MigrationRunner: vi.fn(function runnerConstructor() {
    return {
      up: mockRunnerUp,
      down: mockRunnerDown,
      status: mockRunnerStatus,
    };
  }),
}));

import {
  type DownOptions,
  runDown,
  runStatus,
  runUp,
  type StatusOptions,
  type UpOptions,
} from "../cli";

describe("CLI cleanup", () => {
  const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

  const baseUpOptions: UpOptions = {
    dir: "./migrations",
    connection: "postgresql://test:5432/db",
    table: "_migrations",
    dialect: "postgres",
  };

  const baseDownOptions: DownOptions = {
    dir: "./migrations",
    connection: "postgresql://test:5432/db",
    table: "_migrations",
    dialect: "postgres",
    count: "1",
  };

  const baseStatusOptions: StatusOptions = {
    dir: "./migrations",
    connection: "postgresql://test:5432/db",
    table: "_migrations",
    dialect: "postgres",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("up command", () => {
    it("should call pool.end() before process.exit(0) on success", async () => {
      await runUp(baseUpOptions);

      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("should call pool.end() before process.exit(1) when migration fails", async () => {
      mockRunnerUp.mockRejectedValue(new Error("Migration error"));

      await runUp(baseUpOptions);

      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should call process.exit(1) when connection URL is missing", async () => {
      await runUp({ ...baseUpOptions, connection: undefined });

      expect(mockPoolEnd).toHaveBeenCalledTimes(0);
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("down command", () => {
    it("should call pool.end() before process.exit(0) on success", async () => {
      await runDown(baseDownOptions);

      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it.each([
      ["zero", "0"],
      ["negative", "-1"],
      ["non-numeric", "abc"],
      ["non-integer", "1.5"],
    ])("should reject %s count before calling the runner", async (_label, count) => {
      await runDown({ ...baseDownOptions, count });

      expect(mockRunnerDown).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should call pool.end() before process.exit(1) when reversion fails", async () => {
      mockRunnerDown.mockRejectedValue(new Error("Reversion error"));

      await runDown(baseDownOptions);

      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should call process.exit(1) when connection URL is missing", async () => {
      await runDown({ ...baseDownOptions, connection: undefined });

      expect(mockPoolEnd).toHaveBeenCalledTimes(0);
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("status command", () => {
    it("should call pool.end() before process.exit(0) on success", async () => {
      mockRunnerStatus.mockResolvedValue([
        {
          id: "001",
          name: "create_users",
          executed: true,
          executedAt: new Date(),
        },
        { id: "002", name: "create_posts", executed: false, executedAt: null },
      ]);

      await runStatus(baseStatusOptions);

      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("should call pool.end() before process.exit(1) when status check fails", async () => {
      mockRunnerStatus.mockRejectedValue(new Error("Status error"));

      await runStatus(baseStatusOptions);

      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should call process.exit(1) when connection URL is missing", async () => {
      await runStatus({ ...baseStatusOptions, connection: undefined });

      expect(mockPoolEnd).toHaveBeenCalledTimes(0);
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
