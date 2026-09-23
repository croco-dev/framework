import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Component } from "@croco/framework-context";
import type { DrizzleDB } from "./types.js";

@Component()
export class DrizzleClient {
  private dbInstance: DrizzleDB | null = null;

  get db(): DrizzleDB {
    if (this.dbInstance) {
      return this.dbInstance;
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    this.dbInstance = drizzle(pool);

    return this.dbInstance;
  }
}
