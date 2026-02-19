import type { DrizzleDb } from '@croco/tx-drizzle';
import { sql } from 'drizzle-orm';
import type { HealthIndicator, HealthIndicatorResult } from './HealthIndicator';

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
