import { sql } from 'drizzle-orm';

export async function up(db: { execute: (query: unknown) => Promise<unknown> }) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL
    )
  `);
}

export async function down(db: { execute: (query: unknown) => Promise<unknown> }) {
  await db.execute(sql`DROP TABLE IF EXISTS users`);
}
