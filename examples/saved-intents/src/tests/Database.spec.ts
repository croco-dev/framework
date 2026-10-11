import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { query, release, connect } = vi.hoisted(() => {
  const query = vi.fn();
  const release = vi.fn();
  return { query, release, connect: vi.fn().mockResolvedValue({ query, release }) };
});
vi.mock("pg", () => ({
  Pool: class {
    connect = connect;
    query = query;
  },
}));
beforeEach(() => {
  vi.stubEnv("SAVED_INTENTS_DATABASE_URL", "postgres://test");
  query.mockReset();
  release.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("database transaction", () => {
  it("commits and releases successful work", async () => {
    const { database } = await import("../database");
    await expect(database.transaction(async () => 42)).resolves.toBe(42);
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(["BEGIN", "COMMIT"]);
    expect(release).toHaveBeenCalledExactlyOnceWith(false);
  });
  it("rolls back the original failure and retains a healthy connection", async () => {
    const { database } = await import("../database");
    const original = new Error("work failed");
    await expect(
      database.transaction(async () => {
        throw original;
      }),
    ).rejects.toBe(original);
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(["BEGIN", "ROLLBACK"]);
    expect(release).toHaveBeenCalledExactlyOnceWith(false);
  });
  it("discards a connection after failed rollback while preserving the original failure", async () => {
    const { database } = await import("../database");
    const original = new Error("original work failure");
    query.mockImplementation(async (sql) => {
      if (sql === "ROLLBACK") throw new Error("postgres://secret");
    });
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    await expect(
      database.transaction(async () => {
        throw original;
      }),
    ).rejects.toBe(original);
    expect(release).toHaveBeenCalledExactlyOnceWith(true);
    expect(stderr).toHaveBeenCalledExactlyOnceWith(
      "Saved intent transaction rollback failed; connection discarded\n",
    );
  });
});
