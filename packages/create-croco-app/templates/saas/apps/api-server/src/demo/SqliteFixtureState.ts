import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const STATE_KEY = "state";

type StateRow = {
  value: string;
};

export function readSqliteFixtureState<T>(filePath: string, initialState: T): T {
  const database = openDatabase(filePath);
  try {
    return readState(database, initialState);
  } finally {
    database.close();
  }
}

export function updateSqliteFixtureState<T, R>(
  filePath: string,
  initialState: T,
  operation: (state: T) => R,
): R {
  const database = openDatabase(filePath);
  let transactionStarted = false;
  try {
    database.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    const state = readState(database, initialState);
    const result = operation(state);
    database
      .prepare(
        "INSERT INTO fixture_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(STATE_KEY, JSON.stringify(state));
    database.exec("COMMIT");
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

export function resetSqliteFixtureState<T>(filePath: string, initialState: T): void {
  updateSqliteFixtureState(filePath, initialState, (state) => {
    replaceState(state, initialState);
  });
}

function openDatabase(filePath: string): DatabaseSync {
  mkdirSync(dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);
  database.exec(
    "PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS fixture_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  );
  return database;
}

function readState<T>(database: DatabaseSync, initialState: T): T {
  const row = database.prepare("SELECT value FROM fixture_state WHERE key = ?").get(STATE_KEY) as
    | StateRow
    | undefined;
  return row ? (JSON.parse(row.value) as T) : structuredClone(initialState);
}

function replaceState<T>(target: T, source: T): void {
  if (
    typeof target !== "object" ||
    target === null ||
    typeof source !== "object" ||
    source === null
  ) {
    throw new TypeError("SQLite fixture state must be an object.");
  }
  for (const key of Object.keys(target)) delete (target as Record<string, unknown>)[key];
  Object.assign(target, structuredClone(source));
}
