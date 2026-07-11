import { describe, expect, it } from "vitest";
import { MigrationRunner } from "../libs/MigrationRunner";
import { createMigrationFixtures } from "./helpers/createMigrationFixtures";
import { DeterministicMigrationDatabase } from "./helpers/DeterministicMigrationDatabase";

describe("deterministic migration transaction harness", () => {
  it("publishes one atomic checkpoint winner under deterministic contention", async () => {
    const fixtures = createMigrationFixtures([{ id: "20260711000001", name: "create_accounts" }]);
    const db = new DeterministicMigrationDatabase();
    db.holdSelects(2);

    try {
      const first = new MigrationRunner(db, fixtures.path);
      const second = new MigrationRunner(db, fixtures.path);
      const results = await Promise.all([first.up(), second.up()]);

      expect(results.flat()).toEqual(["20260711000001_create_accounts"]);
      expect(db.snapshot()).toEqual({
        tableExists: true,
        checkpoints: ["20260711000001_create_accounts"],
        bodyEffects: ["up:20260711000001"],
      });
      expect(db.events.filter((event) => event === "body:up:20260711000001")).toHaveLength(1);
      expect(db.events).toContain("checkpoint:reserve:lost:20260711000001");
    } finally {
      fixtures.cleanup();
    }
  });

  it("discards staged body and checkpoint state when a migration fails", async () => {
    const fixtures = createMigrationFixtures([
      { id: "20260711000001", name: "create_accounts" },
      { id: "20260711000002", name: "create_orders", failUp: true },
    ]);
    const db = new DeterministicMigrationDatabase();

    try {
      const runner = new MigrationRunner(db, fixtures.path);

      await expect(runner.up()).rejects.toThrow("up unavailable for 20260711000002");
      expect(db.snapshot()).toEqual({
        tableExists: true,
        checkpoints: ["20260711000001_create_accounts"],
        bodyEffects: ["up:20260711000001"],
      });
      expect(db.events).toContain("transaction:rollback");
    } finally {
      fixtures.cleanup();
    }
  });
});
