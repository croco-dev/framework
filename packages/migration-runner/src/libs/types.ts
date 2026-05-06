import type { DatabaseClient } from './db-types';

export type MigrationDirection = 'up' | 'down';

export interface MigrationRecord {
  id: string;
  name: string;
  executedAt: Date;
}

export interface MigrationFile {
  id: string;
  name: string;
  path: string;
  up: (db: DatabaseClient) => Promise<void>;
  down: (db: DatabaseClient) => Promise<void>;
}

export interface MigrationRunnerConfig {
  migrationsDir: string;
  tableName?: string;
}

export interface MigrationStatus {
  id: string;
  name: string;
  executed: boolean;
  executedAt?: Date;
}
