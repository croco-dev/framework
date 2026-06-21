import type { DatabaseClient } from "./db-types";
import { MigrationScanner } from "./MigrationScanner";
import { MigrationStore } from "./MigrationStore";
import { MigrationTransactionRequiredProblem } from "./problems/MigrationTransactionRequiredProblem";
import { MissingDownFunctionProblem } from "./problems/MissingDownFunctionProblem";
import { MissingUpFunctionProblem } from "./problems/MissingUpFunctionProblem";
import type { MigrationFile, MigrationStatus } from "./types";
import { assertValidMigrationCount } from "./validateMigrationCount";

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

    const files = await this.scanner.scan();
    const executed = await this.store.getExecutedMigrations(this.db);
    const executedIds = new Set(executed.map((m) => m.id));

    const pending = files.filter((f) => !executedIds.has(f.id));
    const toRun = targetId ? pending.filter((f) => f.id <= targetId) : pending;

    const runIds: string[] = [];

    for (const file of toRun) {
      if (typeof file.up !== "function") {
        throw new MissingUpFunctionProblem(file.id, file.name);
      }

      const executed = await this.runUpMigration(file);
      if (executed) {
        runIds.push(`${file.id}_${file.name}`);
      }
    }

    return runIds;
  }

  async down(targetId?: string, count?: number): Promise<string[]> {
    if (!targetId && count !== undefined) {
      assertValidMigrationCount(count);
    }

    await this.init();

    const files = await this.scanner.scan();
    const executed = await this.store.getExecutedMigrations(this.db);

    const fileMap = new Map(files.map((f) => [f.id, f]));
    const runFiles: MigrationFile[] = [];

    for (const record of executed) {
      const file = fileMap.get(record.id);
      if (file) {
        runFiles.push(file);
      }
    }

    let toRevert: MigrationFile[];
    if (targetId) {
      toRevert = runFiles.filter((f) => f.id >= targetId).reverse();
    } else if (count !== undefined) {
      toRevert = runFiles.slice(-count).reverse();
    } else {
      toRevert = runFiles.slice(-1).reverse();
    }

    const revertedIds: string[] = [];

    for (const file of toRevert) {
      if (typeof file.down !== "function") {
        throw new MissingDownFunctionProblem(file.id, file.name);
      }

      const reverted = await this.runDownMigration(file);
      if (reverted) {
        revertedIds.push(`${file.id}_${file.name}`);
      }
    }

    return revertedIds;
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
