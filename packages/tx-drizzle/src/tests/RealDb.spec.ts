import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';

const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
});

describe('RealDb', () => {
  it('should commit transaction', async () => {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite);

    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `);

    db.transaction((tx) => {
      tx.insert(users).values({ name: 'Alice' }).execute();
    });

    const result = await db.select().from(users);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });

  it('should rollback transaction on error', async () => {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite);

    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `);

    expect(() => {
      db.transaction((tx) => {
        tx.insert(users).values({ name: 'Bob' }).execute();
        throw new Error('Intentional error');
      });
    }).toThrow('Intentional error');

    const result = await db.select().from(users);
    expect(result).toHaveLength(0);
  });
});
