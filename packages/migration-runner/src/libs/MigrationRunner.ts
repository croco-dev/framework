import { MigrationScanner } from './MigrationScanner';
import { type DatabaseClient, MigrationStore } from './MigrationStore';
import { MissingDownFunctionProblem } from './problems/MissingDownFunctionProblem';
import { MissingUpFunctionProblem } from './problems/MissingUpFunctionProblem';
import type { MigrationFile, MigrationStatus } from './types';

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
      if (typeof file.up !== 'function') {
        throw new MissingUpFunctionProblem(file.id, file.name);
      }

      await file.up(this.db);
      await this.store.recordMigration(this.db, file.id, file.name);
      runIds.push(`${file.id}_${file.name}`);
    }

    return runIds;
  }

  async down(targetId?: string, count?: number): Promise<string[]> {
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
    } else if (count) {
      toRevert = runFiles.slice(-count).reverse();
    } else {
      toRevert = runFiles.slice(-1).reverse();
    }

    const revertedIds: string[] = [];

    for (const file of toRevert) {
      if (typeof file.down !== 'function') {
        throw new MissingDownFunctionProblem(file.id, file.name);
      }

      await file.down(this.db);
      await this.store.removeMigration(this.db, file.id);
      revertedIds.push(`${file.id}_${file.name}`);
    }

    return revertedIds;
  }
}
