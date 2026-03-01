import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Service } from 'typedi';
import type { DrizzleDB } from './types.js';

@Service()
export class DrizzleClient {
  readonly db: DrizzleDB;

  constructor() {
    const pool = new Pool({
      connectionString: process.env['DATABASE_URL'],
    });
    this.db = drizzle(pool);
  }
}
