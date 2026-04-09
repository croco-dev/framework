import { sql } from 'drizzle-orm';

export async function up(db: { execute: (query: unknown) => Promise<unknown> }) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      user_id INTEGER REFERENCES users(id)
    )
  `);
}

export async function down(db: { execute: (query: unknown) => Promise<unknown> }) {
  await db.execute(sql`DROP TABLE IF EXISTS posts`);
}
