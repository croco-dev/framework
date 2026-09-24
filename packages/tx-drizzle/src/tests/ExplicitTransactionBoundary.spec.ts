import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { afterEach, describe, expect, it } from "vitest";
import { Transactional, TxManager, type TxAdapter } from "@croco/tx-core";

const entries = sqliteTable("entries", {
  id: integer("id").primaryKey(),
  owner: text("owner").notNull(),
});

type SqliteClient = ReturnType<typeof drizzle>;

function activeClient(manager: TxManager<SqliteClient>): SqliteClient {
  const client = manager.getClient();
  if (!client) {
    throw new Error("Expected an active transaction client");
  }
  return client;
}

function createSqliteAdapter(
  sqlite: Database.Database,
  client: SqliteClient,
): TxAdapter<SqliteClient> {
  return {
    async transaction(fn) {
      sqlite.exec("BEGIN");
      try {
        const result = await fn(client);
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    async savepoint(_client, fn) {
      sqlite.exec("SAVEPOINT nested_tx");
      try {
        const result = await fn(client);
        sqlite.exec("RELEASE SAVEPOINT nested_tx");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK TO SAVEPOINT nested_tx");
        sqlite.exec("RELEASE SAVEPOINT nested_tx");
        throw error;
      }
    },
    supportsSavepoint: () => true,
  };
}

class EntryService {
  constructor(
    readonly manager: TxManager<SqliteClient>,
    readonly owner: string,
  ) {}

  @Transactional((service: EntryService) => service.manager)
  async create(id: number, fail = false): Promise<void> {
    activeClient(this.manager).insert(entries).values({ id, owner: this.owner }).run();
    if (fail) {
      throw new Error("write rejected");
    }
  }
}

describe("explicit transaction boundaries with temporary SQLite databases", () => {
  const databases: Database.Database[] = [];
  const directories: string[] = [];

  function createApplication(owner: string) {
    const directory = mkdtempSync(join(tmpdir(), "croco-tx-boundary-"));
    directories.push(directory);
    const path = join(directory, "application.sqlite");
    const sqlite = new Database(path);
    databases.push(sqlite);
    sqlite.exec("CREATE TABLE entries (id INTEGER PRIMARY KEY, owner TEXT NOT NULL)");
    const client = drizzle(sqlite);
    const manager = new TxManager(createSqliteAdapter(sqlite, client));
    return { client, manager, path, service: new EntryService(manager, owner) };
  }

  afterEach(() => {
    for (const database of databases.splice(0)) {
      database.close();
    }
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("commits a decorated write and rolls back a failed write on the selected receiver manager", async () => {
    const app = createApplication("first");

    await app.service.create(1);
    await expect(app.service.create(2, true)).rejects.toThrow("write rejected");

    expect(app.client.select().from(entries).all()).toEqual([{ id: 1, owner: "first" }]);
    expect(app.manager.isInTransaction()).toBe(false);
  });

  it("keeps concurrent application managers and their database writes isolated", async () => {
    const first = createApplication("first");
    const second = createApplication("second");
    const firstObserver = new Database(first.path);
    databases.push(firstObserver);
    let releaseFirst!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstStarted!: () => void;
    const firstDidStart = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });

    const firstRun = first.manager.run(async () => {
      activeClient(first.manager).insert(entries).values({ id: 1, owner: "first" }).run();
      firstStarted();
      await firstCanFinish;
    });
    await firstDidStart;

    await second.service.create(2);
    expect(first.manager.isInTransaction()).toBe(false);
    expect(second.manager.isInTransaction()).toBe(false);
    expect(firstObserver.prepare("SELECT id, owner FROM entries").all()).toEqual([]);
    expect(second.client.select().from(entries).all()).toEqual([{ id: 2, owner: "second" }]);

    releaseFirst();
    await firstRun;
    expect(firstObserver.prepare("SELECT id, owner FROM entries").all()).toEqual([
      { id: 1, owner: "first" },
    ]);
  });

  it("runs after-commit hooks only after a real commit and suppresses them on rollback", async () => {
    const app = createApplication("first");
    const observer = new Database(app.path);
    databases.push(observer);
    const observed: number[] = [];

    const outcome = await app.manager.runWithOutcome(async () => {
      activeClient(app.manager).insert(entries).values({ id: 1, owner: "first" }).run();
      app.manager.onAfterCommit(() => {
        const row = observer.prepare("SELECT COUNT(*) AS count FROM entries").get() as {
          count: number;
        };
        observed.push(row.count);
      });
    });

    expect(outcome.status).toBe("committed");
    expect(observed).toEqual([1]);

    await expect(
      app.manager.runWithOutcome(async () => {
        activeClient(app.manager).insert(entries).values({ id: 2, owner: "first" }).run();
        app.manager.onAfterCommit(() => {
          observed.push(2);
        });
        throw new Error("write rejected");
      }),
    ).rejects.toThrow("write rejected");

    expect(observed).toEqual([1]);
    expect(app.client.select().from(entries).all()).toEqual([{ id: 1, owner: "first" }]);
  });
});
