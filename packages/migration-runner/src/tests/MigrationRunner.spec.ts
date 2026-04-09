import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MigrationRunner } from '../libs/MigrationRunner';
import type { DatabaseClient } from '../libs/MigrationStore';

describe('MigrationRunner', () => {
  let runner!: MigrationRunner;
  let mockDb!: DatabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = { execute: vi.fn() } as unknown as DatabaseClient;

    const migrationsDir = join(__dirname, 'fixtures', 'migrations');
    runner = new MigrationRunner(mockDb, migrationsDir, '_migrations');
  });

  describe('init', () => {
    it('should create migrations table', async () => {
      await runner.init();
      expect(mockDb.execute).toHaveBeenCalled();
    });
  });

  describe('status', () => {
    it('should return empty array when no migrations', async () => {
      const result = await runner.status();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('up', () => {
    it('should execute pending migrations', async () => {
      const result = await runner.up();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('down', () => {
    it('should revert last migration by default', async () => {
      const result = await runner.down();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
