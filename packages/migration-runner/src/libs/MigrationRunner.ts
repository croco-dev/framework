import type { DatabaseClient } from "./db-types";
import { MigrationScanner } from "./MigrationScanner";
import { MigrationStore } from "./MigrationStore";
import { MigrationTransactionRequiredProblem } from "./problems/MigrationTransactionRequiredProblem";
import { MissingDownFunctionProblem } from "./problems/MissingDownFunctionProblem";
import { MissingUpFunctionProblem } from "./problems/MissingUpFunctionProblem";
import type { MigrationFile, MigrationStatus } from "./types";
import { assertValidMigrationCount } from "./validateMigrationCount";

const PREVIEW_ROLLBACK = Symbol("migration-preview-rollback");

export class MigrationRunner {
  private readonly scanner: MigrationScanner;
  private readonly store: MigrationStore;
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient, migrationsDir: string, tableName?: string) {
    this.db = db;
    this.scanner = new MigrationScanner(migrationsDir);
    this.store = new MigrationStore(tableName);
  }

  async init(): Promise<void> {
    await this.store.ensureTable(this.db);
  }

  async status(): Promise<MigrationStatus[]> {
    const files = await this.scanner.scan();
    const executed = await this.store.getExecutedMigrations(this.db);
    const executedMap = new Map(executed.map((m) => [m.id, m]));

    return files.map((file) => {
      const record = executedMap.get(file.id);
      return {
        id: file.id,
        name: file.name,
        executed: !!record,
        executedAt: record?.executedAt,
      };
    });
  }

  async up(targetId?: string): Promise<string[]> {
    await this.init();
    const toRun = await this.selectUpMigrations(this.db, targetId);

    const runIds: string[] = [];

    for (const file of toRun) {
      this.assertUpMigration(file);

      const executed = await this.runUpMigration(file);
      if (executed) {
        runIds.push(`${file.id}_${file.name}`);
      }
    }

    return runIds;
  }

  async down(targetId?: string, count?: number): Promise<string[]> {
    this.assertDownCount(targetId, count);
    await this.init();
    const toRevert = await this.selectDownMigrations(this.db, targetId, count);

    const revertedIds: string[] = [];

    for (const file of toRevert) {
      this.assertDownMigration(file);

      const reverted = await this.runDownMigration(file);
      if (reverted) {
        revertedIds.push(`${file.id}_${file.name}`);
      }
    }

    return revertedIds;
  }

  async previewUp(targetId?: string): Promise<string[]> {
    return this.preview("up", async (db) => {
      const migrations = await this.selectUpMigrations(db, targetId);
      for (const migration of migrations) {
        this.assertUpMigration(migration);
      }
      return migrations;
    });
  }

  async previewDown(targetId?: string, count?: number): Promise<string[]> {
    this.assertDownCount(targetId, count);
    return this.preview("down", async (db) => {
      const migrations = await this.selectDownMigrations(db, targetId, count);
      for (const migration of migrations) {
        this.assertDownMigration(migration);
      }
      return migrations;
    });
  }

  private async preview(
    direction: "up" | "down",
    select: (db: DatabaseClient) => Promise<MigrationFile[]>,
  ): Promise<string[]> {
    if (!this.db.transaction) {
      throw new MigrationTransactionRequiredProblem(direction);
    }

    let selected: MigrationFile[] = [];

    try {
      await this.db.transaction(async (tx) => {
        await this.store.ensureTable(tx);
        selected = await select(tx);
        throw PREVIEW_ROLLBACK;
      });
    } catch (error) {
      if (error !== PREVIEW_ROLLBACK) {
        throw error;
      }
    }

    return selected.map(({ id, name }) => `${id}_${name}`);
  }

  private async selectUpMigrations(
    db: DatabaseClient,
    targetId?: string,
  ): Promise<MigrationFile[]> {
    const files = await this.scanner.scan();
    const executed = await this.store.getExecutedMigrations(db);
    const executedIds = new Set(executed.map((migration) => migration.id));
    const pending = files.filter((file) => !executedIds.has(file.id));
    return targetId ? pending.filter((file) => file.id <= targetId) : pending;
  }

  private async selectDownMigrations(
    db: DatabaseClient,
    targetId?: string,
    count?: number,
  ): Promise<MigrationFile[]> {
    const files = await this.scanner.scan();
    const executed = await this.store.getExecutedMigrations(db);
    const fileMap = new Map(files.map((file) => [file.id, file]));
    const runFiles = executed.flatMap((record) => {
      const file = fileMap.get(record.id);
      return file ? [file] : [];
    });

    if (targetId) {
      return runFiles.filter((file) => file.id >= targetId).reverse();
    }
    if (count !== undefined) {
      return runFiles.slice(-count).reverse();
    }
    return runFiles.slice(-1).reverse();
  }

  private assertDownCount(targetId?: string, count?: number): void {
    if (!targetId && count !== undefined) {
      assertValidMigrationCount(count);
    }
  }

  private assertUpMigration(file: MigrationFile): void {
    if (typeof file.up !== "function") {
      throw new MissingUpFunctionProblem(file.id, file.name);
    }
  }

  private assertDownMigration(file: MigrationFile): void {
    if (typeof file.down !== "function") {
      throw new MissingDownFunctionProblem(file.id, file.name);
    }
  }

  private async runUpMigration(file: MigrationFile): Promise<boolean> {
    if (!this.db.transaction) {
      throw new MigrationTransactionRequiredProblem("up");
    }

    return this.db.transaction(async (tx) => {
      const reserved = await this.store.reserveMigration(tx, file.id, file.name);
      if (!reserved) {
        return false;
      }

      await file.up(tx);
      await this.store.completeMigration(tx, file.id);
      return true;
    });
  }

  private async runDownMigration(file: MigrationFile): Promise<boolean> {
    if (!this.db.transaction) {
      throw new MigrationTransactionRequiredProblem("down");
    }

    return this.db.transaction(async (tx) => {
      const claimed = await this.store.claimMigrationForRollback(tx, file.id);
      if (!claimed) {
        return false;
      }

      await file.down(tx);
      return true;
    });
  }
}
