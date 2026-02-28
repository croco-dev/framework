import { sql } from 'drizzle-orm';
import type { DrizzleDb } from './types';

type HealthIndicatorResult = {
  name: string;
  status: 'up' | 'down';
  details?: Record<string, unknown>;
};

interface HealthIndicator {
  check(): Promise<HealthIndicatorResult>;
}

export type DrizzleHealthIndicatorOptions = {
  name?: string;
};

export class DrizzleHealthIndicator implements HealthIndicator {
  private readonly db: DrizzleDb;
  private readonly name: string;

  constructor(db: DrizzleDb, options: DrizzleHealthIndicatorOptions = {}) {
    this.db = db;
    this.name = options.name ?? 'database';
  }

  async check(): Promise<HealthIndicatorResult> {
    try {
      await this.db.transaction(async (tx) => {
        await (tx as unknown as { execute: (query: unknown) => Promise<unknown> }).execute(sql`SELECT 1`);
      });

      return {
        name: this.name,
        status: 'up',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      return {
        name: this.name,
        status: 'down',
        details: { error: message },
      };
    }
  }
}
