import { describe, expect, it } from "vitest";
import { createProgram, type MigrationCliRuntime } from "../cli";
import { MigrationRunner } from "../libs/MigrationRunner";
import { createMigrationFixtures } from "./helpers/createMigrationFixtures";
import { DeterministicMigrationDatabase } from "./helpers/DeterministicMigrationDatabase";

describe("migration command end-to-end", () => {
  it("executes ordered migrations once and reports a repeated up as already applied", async () => {
    const fixtures = createMigrationFixtures([
      { id: "20260711000001", name: "create_accounts" },
      { id: "20260711000002", name: "create_orders" },
    ]);
    const harness = createCommandHarness();

    try {
      await harness.run(commandArgs("up", fixtures.path));

      expect(harness.db.snapshot()).toEqual({
        tableExists: true,
        checkpoints: ["20260711000001_create_accounts", "20260711000002_create_orders"],
        bodyEffects: ["up:20260711000001", "up:20260711000002"],
      });
      expect(harness.exitCodes).toEqual([0]);
      expect(commandSignals(harness)).toMatchInlineSnapshot(`
        {
          "exitCodes": [
            0,
          ],
          "lifecycle": [
            "db:open",
            "pool:end",
            "exit:0",
          ],
          "stderr": [],
          "stdout": [
            "Executed 2 migration(s):",
            "  ✓ 20260711000001_create_accounts",
            "  ✓ 20260711000002_create_orders",
          ],
        }
      `);

      harness.clearSignals();
      await harness.run(commandArgs("up", fixtures.path));

      expect(harness.db.snapshot()).toEqual({
        tableExists: true,
        checkpoints: ["20260711000001_create_accounts", "20260711000002_create_orders"],
        bodyEffects: ["up:20260711000001", "up:20260711000002"],
      });
      expect(harness.exitCodes).toEqual([0]);
      expect(commandSignals(harness)).toMatchInlineSnapshot(`
        {
          "exitCodes": [
            0,
          ],
          "lifecycle": [
            "db:open",
            "pool:end",
            "exit:0",
          ],
          "stderr": [],
          "stdout": [
            "No pending migrations",
          ],
        }
      `);
    } finally {
      fixtures.cleanup();
    }
  });

  it("parses real up --dry-run argv and leaves a fresh backend unchanged", async () => {
    const fixtures = createMigrationFixtures([
      { id: "20260711000001", name: "create_accounts" },
      { id: "20260711000002", name: "create_orders" },
    ]);
    const harness = createCommandHarness();
    const before = harness.db.snapshot();

    try {
      await harness.run([
        "up",
        "--dry-run",
        "--dir",
        fixtures.path,
        "--connection",
        "postgresql://deterministic.test/migrations",
      ]);

      expect(harness.db.snapshot()).toEqual(before);
      expect(harness.exitCodes).toEqual([0]);
      expect(commandSignals(harness)).toMatchInlineSnapshot(`
        {
          "exitCodes": [
            0,
          ],
          "lifecycle": [
            "db:open",
            "pool:end",
            "exit:0",
          ],
          "stderr": [],
          "stdout": [
            "Would execute 2 migration(s):",
            "  ○ 20260711000001_create_accounts",
            "  ○ 20260711000002_create_orders",
          ],
        }
      `);
    } finally {
      fixtures.cleanup();
    }
  });

  it("uses runner previews for up and down without publishing transactional initialization", async () => {
    const fixtures = createMigrationFixtures([
      { id: "20260711000001", name: "create_accounts" },
      { id: "20260711000002", name: "create_orders" },
    ]);
    const db = new DeterministicMigrationDatabase();

    try {
      const runner = new MigrationRunner(db, fixtures.path);
      const fresh = db.snapshot();

      await expect(runner.previewUp()).resolves.toEqual([
        "20260711000001_create_accounts",
        "20260711000002_create_orders",
      ]);
      expect(db.snapshot()).toEqual(fresh);

      await runner.up();
      const applied = db.snapshot();

      await expect(runner.previewDown(undefined, 1)).resolves.toEqual([
        "20260711000002_create_orders",
      ]);
      expect(db.snapshot()).toEqual(applied);
    } finally {
      fixtures.cleanup();
    }
  });

  it("parses real down --dry-run argv and preserves applied state", async () => {
    const fixtures = createMigrationFixtures([
      { id: "20260711000001", name: "create_accounts" },
      { id: "20260711000002", name: "create_orders" },
    ]);
    const harness = createCommandHarness();

    try {
      await new MigrationRunner(harness.db, fixtures.path).up();
      const before = harness.db.snapshot();

      await harness.run([
        "down",
        "--dry-run",
        "--count",
        "1",
        "--dir",
        fixtures.path,
        "--connection",
        "postgresql://deterministic.test/migrations",
      ]);

      expect(harness.db.snapshot()).toEqual(before);
      expect(harness.exitCodes).toEqual([0]);
      expect(commandSignals(harness)).toMatchInlineSnapshot(`
        {
          "exitCodes": [
            0,
          ],
          "lifecycle": [
            "db:open",
            "pool:end",
            "exit:0",
          ],
          "stderr": [],
          "stdout": [
            "Would revert 1 migration(s):",
            "  ○ 20260711000002_create_orders",
          ],
        }
      `);
    } finally {
      fixtures.cleanup();
    }
  });

  it("reverts migrations by count in latest-first order", async () => {
    const fixtures = createMigrationFixtures([
      { id: "20260711000001", name: "create_accounts" },
      { id: "20260711000002", name: "create_orders" },
    ]);
    const harness = createCommandHarness();

    try {
      await harness.run(commandArgs("up", fixtures.path));
      harness.clearSignals();

      await harness.run([...commandArgs("down", fixtures.path), "--count", "1"]);

      expect(harness.db.snapshot()).toEqual({
        tableExists: true,
        checkpoints: ["20260711000001_create_accounts"],
        bodyEffects: ["up:20260711000001", "up:20260711000002", "down:20260711000002"],
      });
      expect(harness.stdout).toEqual([
        "Reverted 1 migration(s):",
        "  ↓ 20260711000002_create_orders",
      ]);
      expect(harness.stderr).toEqual([]);
      expect(harness.exitCodes).toEqual([0]);
    } finally {
      fixtures.cleanup();
    }
  });

  it("reverts the target and later migrations in reverse order", async () => {
    const fixtures = createMigrationFixtures([
      { id: "20260711000001", name: "create_accounts" },
      { id: "20260711000002", name: "create_orders" },
      { id: "20260711000003", name: "create_invoices" },
    ]);
    const harness = createCommandHarness();

    try {
      await harness.run(commandArgs("up", fixtures.path));
      harness.clearSignals();

      await harness.run([...commandArgs("down", fixtures.path), "--target", "20260711000002"]);

      expect(harness.db.snapshot()).toEqual({
        tableExists: true,
        checkpoints: ["20260711000001_create_accounts"],
        bodyEffects: [
          "up:20260711000001",
          "up:20260711000002",
          "up:20260711000003",
          "down:20260711000003",
          "down:20260711000002",
        ],
      });
      expect(harness.stdout).toEqual([
        "Reverted 2 migration(s):",
        "  ↓ 20260711000003_create_invoices",
        "  ↓ 20260711000002_create_orders",
      ]);
      expect(harness.stderr).toEqual([]);
      expect(harness.exitCodes).toEqual([0]);
    } finally {
      fixtures.cleanup();
    }
  });

  it("propagates an unexpected preview failure and closes the pool before reporting failure", async () => {
    const fixtures = createMigrationFixtures([{ id: "20260711000001", name: "create_accounts" }]);
    const harness = createCommandHarness();
    harness.db.failNextSelect(new Error("preview checkpoint unavailable"));

    try {
      await harness.run([
        "up",
        "--dry-run",
        "--dir",
        fixtures.path,
        "--connection",
        "postgresql://deterministic.test/migrations",
      ]);

      expect(harness.db.snapshot()).toEqual({
        tableExists: false,
        checkpoints: [],
        bodyEffects: [],
      });
      expect(harness.stdout).toEqual([]);
      expect(harness.stderr).toEqual(["Migration failed: preview checkpoint unavailable"]);
      expect(harness.exitCodes).toEqual([1]);
      expect(harness.lifecycle.slice(-2)).toEqual(["pool:end", "exit:1"]);
    } finally {
      fixtures.cleanup();
    }
  });

  it("describes per-migration rollback without claiming the whole command rolled back", async () => {
    const fixtures = createMigrationFixtures([
      { id: "20260711000001", name: "create_accounts" },
      { id: "20260711000002", name: "create_orders", failUp: true },
    ]);
    const harness = createCommandHarness();

    try {
      await harness.run([
        "up",
        "--dir",
        fixtures.path,
        "--connection",
        "postgresql://deterministic.test/migrations",
      ]);

      expect(harness.db.snapshot()).toEqual({
        tableExists: true,
        checkpoints: ["20260711000001_create_accounts"],
        bodyEffects: ["up:20260711000001"],
      });
      expect(harness.exitCodes).toEqual([1]);
      expect(commandSignals(harness)).toMatchInlineSnapshot(`
        {
          "exitCodes": [
            1,
          ],
          "lifecycle": [
            "db:open",
            "pool:end",
            "exit:1",
          ],
          "stderr": [
            "Migration failed: up unavailable for 20260711000002",
            "Recovery: Forward migration state is uncertain. Inspect \`migrate status\` and the database state, correct the reported failure, then rerun \`migrate up\`.",
          ],
          "stdout": [],
        }
      `);
    } finally {
      fixtures.cleanup();
    }
  });

  it("reruns a corrected failed up without checkpoint repair or stale module state", async () => {
    const failing = createMigrationFixtures([
      { id: "20260711000001", name: "create_accounts" },
      { id: "20260711000002", name: "create_orders", failUp: true },
    ]);
    const harness = createCommandHarness();
    let corrected: ReturnType<typeof createMigrationFixtures> | undefined;

    try {
      await harness.run(commandArgs("up", failing.path));
      expect(harness.db.snapshot().checkpoints).toEqual(["20260711000001_create_accounts"]);

      corrected = createMigrationFixtures([
        { id: "20260711000001", name: "create_accounts" },
        { id: "20260711000002", name: "create_orders" },
      ]);
      harness.clearSignals();
      await harness.run(commandArgs("up", corrected.path));

      expect(harness.db.snapshot()).toEqual({
        tableExists: true,
        checkpoints: ["20260711000001_create_accounts", "20260711000002_create_orders"],
        bodyEffects: ["up:20260711000001", "up:20260711000002"],
      });
      expect(harness.stdout).toEqual([
        "Executed 1 migration(s):",
        "  ✓ 20260711000002_create_orders",
      ]);
      expect(harness.stderr).toEqual([]);
      expect(harness.exitCodes).toEqual([0]);
    } finally {
      failing.cleanup();
      corrected?.cleanup();
    }
  });

  it("rolls back a failed down and succeeds after the migration is corrected", async () => {
    const failing = createMigrationFixtures([
      { id: "20260711000001", name: "create_accounts" },
      { id: "20260711000002", name: "create_orders", failDown: true },
    ]);
    const harness = createCommandHarness();
    let corrected: ReturnType<typeof createMigrationFixtures> | undefined;

    try {
      await harness.run(commandArgs("up", failing.path));
      harness.clearSignals();
      await harness.run([...commandArgs("down", failing.path), "--count", "1"]);

      expect(harness.db.snapshot()).toEqual({
        tableExists: true,
        checkpoints: ["20260711000001_create_accounts", "20260711000002_create_orders"],
        bodyEffects: ["up:20260711000001", "up:20260711000002"],
      });
      expect(harness.exitCodes).toEqual([1]);
      expect(commandSignals(harness)).toMatchInlineSnapshot(`
        {
          "exitCodes": [
            1,
          ],
          "lifecycle": [
            "db:open",
            "pool:end",
            "exit:1",
          ],
          "stderr": [
            "Migration failed: down unavailable for 20260711000002",
            "Recovery: Rollback state is uncertain. Inspect \`migrate status\` and the database state, correct the reported failure, then rerun \`migrate down\`.",
          ],
          "stdout": [],
        }
      `);

      corrected = createMigrationFixtures([
        { id: "20260711000001", name: "create_accounts" },
        { id: "20260711000002", name: "create_orders" },
      ]);
      harness.clearSignals();
      await harness.run([...commandArgs("down", corrected.path), "--count", "1"]);

      expect(harness.db.snapshot()).toEqual({
        tableExists: true,
        checkpoints: ["20260711000001_create_accounts"],
        bodyEffects: ["up:20260711000001", "up:20260711000002", "down:20260711000002"],
      });
      expect(harness.stdout).toEqual([
        "Reverted 1 migration(s):",
        "  ↓ 20260711000002_create_orders",
      ]);
      expect(harness.stderr).toEqual([]);
      expect(harness.exitCodes).toEqual([0]);
    } finally {
      failing.cleanup();
      corrected?.cleanup();
    }
  });

  it("allows only one concurrent down command to claim a checkpoint", async () => {
    const fixtures = createMigrationFixtures([{ id: "20260711000001", name: "create_accounts" }]);
    const harness = createCommandHarness();

    try {
      await harness.run(commandArgs("up", fixtures.path));
      harness.clearSignals();
      harness.db.holdSelects(2);

      await Promise.all([
        harness.run(commandArgs("down", fixtures.path)),
        harness.run(commandArgs("down", fixtures.path)),
      ]);

      expect(harness.db.snapshot()).toEqual({
        tableExists: true,
        checkpoints: [],
        bodyEffects: ["up:20260711000001", "down:20260711000001"],
      });
      expect(harness.stdout).toHaveLength(3);
      expect(harness.stdout).toContain("Reverted 1 migration(s):");
      expect(harness.stdout).toContain("  ↓ 20260711000001_create_accounts");
      expect(harness.stdout).toContain("No migrations to revert");
      expect(harness.stderr).toEqual([]);
      expect(harness.exitCodes).toEqual([0, 0]);
      expect(
        harness.db.events.filter((event) => event === "body:down:20260711000001"),
      ).toHaveLength(1);
      expect(harness.db.events).toContain("checkpoint:claim:lost:20260711000001");
    } finally {
      fixtures.cleanup();
    }
  });

  it("reports preview no-ops without mutating initialized state", async () => {
    const fixtures = createMigrationFixtures([{ id: "20260711000001", name: "create_accounts" }]);
    const harness = createCommandHarness();

    try {
      await harness.run(commandArgs("up", fixtures.path));
      const applied = harness.db.snapshot();
      harness.clearSignals();

      await harness.run([...commandArgs("up", fixtures.path), "--dry-run"]);

      expect(harness.db.snapshot()).toEqual(applied);
      expect(harness.exitCodes).toEqual([0]);
      expect(commandSignals(harness)).toMatchInlineSnapshot(`
        {
          "exitCodes": [
            0,
          ],
          "lifecycle": [
            "db:open",
            "pool:end",
            "exit:0",
          ],
          "stderr": [],
          "stdout": [
            "No pending migrations to execute",
          ],
        }
      `);

      await harness.run([...commandArgs("down", fixtures.path), "--count", "1"]);
      const reverted = harness.db.snapshot();
      harness.clearSignals();
      await harness.run([...commandArgs("down", fixtures.path), "--dry-run"]);

      expect(harness.db.snapshot()).toEqual(reverted);
      expect(harness.exitCodes).toEqual([0]);
      expect(commandSignals(harness)).toMatchInlineSnapshot(`
        {
          "exitCodes": [
            0,
          ],
          "lifecycle": [
            "db:open",
            "pool:end",
            "exit:0",
          ],
          "stderr": [],
          "stdout": [
            "No migrations to revert",
          ],
        }
      `);
    } finally {
      fixtures.cleanup();
    }
  });

  it("reports cleanup failure after successful execution and records a nonzero exit", async () => {
    const fixtures = createMigrationFixtures([{ id: "20260711000001", name: "create_accounts" }]);
    const harness = createCommandHarness({ poolEndError: new Error("pool cleanup unavailable") });

    try {
      await harness.run(commandArgs("up", fixtures.path));

      expect(harness.exitCodes).toEqual([1]);
      expect(commandSignals(harness)).toMatchInlineSnapshot(`
        {
          "exitCodes": [
            1,
          ],
          "lifecycle": [
            "db:open",
            "pool:end",
            "exit:1",
          ],
          "stderr": [
            "Cleanup failed: pool cleanup unavailable",
          ],
          "stdout": [
            "Executed 1 migration(s):",
            "  ✓ 20260711000001_create_accounts",
          ],
        }
      `);
    } finally {
      fixtures.cleanup();
    }
  });

  it("preserves the operation failure before reporting cleanup failure", async () => {
    const fixtures = createMigrationFixtures([{ id: "20260711000001", name: "create_accounts" }]);
    const harness = createCommandHarness({ poolEndError: new Error("pool cleanup unavailable") });
    harness.db.failNextSelect(new Error("checkpoint selection unavailable"));

    try {
      await harness.run(commandArgs("up", fixtures.path));

      expect(harness.exitCodes).toEqual([1]);
      expect(commandSignals(harness)).toMatchInlineSnapshot(`
        {
          "exitCodes": [
            1,
          ],
          "lifecycle": [
            "db:open",
            "pool:end",
            "exit:1",
          ],
          "stderr": [
            "Migration failed: checkpoint selection unavailable",
            "Recovery: Forward migration state is uncertain. Inspect \`migrate status\` and the database state, correct the reported failure, then rerun \`migrate up\`.",
            "Cleanup failed: pool cleanup unavailable",
          ],
          "stdout": [],
        }
      `);
    } finally {
      fixtures.cleanup();
    }
  });

  it("reports cleanup failure after dry-run without execution recovery guidance", async () => {
    const fixtures = createMigrationFixtures([{ id: "20260711000001", name: "create_accounts" }]);
    const harness = createCommandHarness({ poolEndError: new Error("pool cleanup unavailable") });

    try {
      await harness.run([...commandArgs("up", fixtures.path), "--dry-run"]);

      expect(harness.db.snapshot()).toEqual({
        tableExists: false,
        checkpoints: [],
        bodyEffects: [],
      });
      expect(harness.exitCodes).toEqual([1]);
      expect(commandSignals(harness)).toMatchInlineSnapshot(`
        {
          "exitCodes": [
            1,
          ],
          "lifecycle": [
            "db:open",
            "pool:end",
            "exit:1",
          ],
          "stderr": [
            "Cleanup failed: pool cleanup unavailable",
          ],
          "stdout": [
            "Would execute 1 migration(s):",
            "  ○ 20260711000001_create_accounts",
          ],
        }
      `);
    } finally {
      fixtures.cleanup();
    }
  });

  it("uses the shared cleanup failure contract for status", async () => {
    const fixtures = createMigrationFixtures([]);
    const harness = createCommandHarness({ poolEndError: new Error("pool cleanup unavailable") });

    try {
      await new MigrationRunner(harness.db, fixtures.path).up();
      await harness.run([
        "status",
        "--dir",
        fixtures.path,
        "--connection",
        "postgresql://deterministic.test/migrations",
      ]);

      expect(harness.exitCodes).toEqual([1]);
      expect(commandSignals(harness)).toMatchInlineSnapshot(`
        {
          "exitCodes": [
            1,
          ],
          "lifecycle": [
            "db:open",
            "pool:end",
            "exit:1",
          ],
          "stderr": [
            "Cleanup failed: pool cleanup unavailable",
          ],
          "stdout": [
            "No migrations found",
          ],
        }
      `);
    } finally {
      fixtures.cleanup();
    }
  });

  it.each(["0", "-1", "1.5", "abc"])(
    "rejects invalid down count %s before opening the database",
    async (count) => {
      const fixtures = createMigrationFixtures([{ id: "20260711000001", name: "create_accounts" }]);
      const harness = createCommandHarness();

      try {
        await harness.run([...commandArgs("down", fixtures.path), "--count", count]);

        expect(harness.db.snapshot()).toEqual({
          tableExists: false,
          checkpoints: [],
          bodyEffects: [],
        });
        expect(harness.exitCodes).toEqual([1]);
        expect(commandSignals(harness)).toEqual({
          stdout: [],
          stderr: [
            `Migration failed: migration-runner/invalid-count (400 Bad Request): Migration rollback count must be a positive integer greater than 0: ${count}`,
          ],
          exitCodes: [1],
          lifecycle: ["exit:1"],
        });
      } finally {
        fixtures.cleanup();
      }
    },
  );
});

type CommandHarness = {
  readonly db: DeterministicMigrationDatabase;
  readonly stdout: string[];
  readonly stderr: string[];
  readonly exitCodes: number[];
  readonly lifecycle: string[];
  readonly clearSignals: () => void;
  readonly run: (args: readonly string[]) => Promise<void>;
};

type CommandHarnessOptions = {
  readonly poolEndError?: Error;
};

function createCommandHarness(options: CommandHarnessOptions = {}): CommandHarness {
  const db = new DeterministicMigrationDatabase();
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCodes: number[] = [];
  const lifecycle: string[] = [];
  const runtime: MigrationCliRuntime = {
    async createDbClient() {
      lifecycle.push("db:open");
      return {
        db,
        pool: {
          async end() {
            await Promise.resolve();
            lifecycle.push("pool:end");
            if (options.poolEndError) {
              throw options.poolEndError;
            }
          },
        },
      };
    },
    writeOutput(message) {
      stdout.push(message);
    },
    writeError(message) {
      stderr.push(message);
    },
    exit(code) {
      exitCodes.push(code);
      lifecycle.push(`exit:${code}`);
    },
  };

  return {
    db,
    stdout,
    stderr,
    exitCodes,
    lifecycle,
    clearSignals() {
      stdout.length = 0;
      stderr.length = 0;
      exitCodes.length = 0;
      lifecycle.length = 0;
    },
    async run(args) {
      await createProgram(runtime).parseAsync(["node", "migrate", ...args]);
    },
  };
}

function commandSignals(harness: CommandHarness): {
  stdout: string[];
  stderr: string[];
  exitCodes: number[];
  lifecycle: string[];
} {
  return {
    stdout: [...harness.stdout],
    stderr: [...harness.stderr],
    exitCodes: [...harness.exitCodes],
    lifecycle: [...harness.lifecycle],
  };
}

function commandArgs(command: "up" | "down", migrationsDir: string): string[] {
  return [
    command,
    "--dir",
    migrationsDir,
    "--connection",
    "postgresql://deterministic.test/migrations",
  ];
}
