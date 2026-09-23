import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DomainEvent, EventBusConfig, EventPublisher, type EventBus } from "@croco/events-core";
import { Transactional, TxManager, type TxAdapter } from "@croco/tx-core";
import { afterEach, describe, expect, it } from "vitest";

class RowWrittenEvent extends DomainEvent {
  static eventName = "RowWritten";

  constructor(
    readonly owner: string,
    readonly id: number,
  ) {
    super();
  }
}

function createSqliteAdapter(database: DatabaseSync): TxAdapter<DatabaseSync> {
  return {
    async transaction(fn) {
      database.exec("BEGIN");
      try {
        const result = await fn(database);
        database.exec("COMMIT");
        return result;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    async savepoint(_client, fn) {
      database.exec("SAVEPOINT nested_tx");
      try {
        const result = await fn(database);
        database.exec("RELEASE SAVEPOINT nested_tx");
        return result;
      } catch (error) {
        database.exec("ROLLBACK TO SAVEPOINT nested_tx");
        database.exec("RELEASE SAVEPOINT nested_tx");
        throw error;
      }
    },
    supportsSavepoint: () => true,
  };
}

class RowService {
  constructor(
    readonly manager: TxManager<DatabaseSync>,
    private readonly publisher: EventPublisher,
    private readonly owner: string,
  ) {}

  @Transactional((service: RowService) => service.manager)
  async write(id: number, fail = false): Promise<void> {
    const database = this.manager.getClient();
    if (!database) {
      throw new Error("Expected an active transaction client");
    }
    database.prepare("INSERT INTO rows (id, owner) VALUES (?, ?)").run(id, this.owner);
    this.publisher.publishAfterCommit(new RowWrittenEvent(this.owner, id));
    if (fail) {
      throw new Error("write rejected");
    }
  }
}

describe("injected transaction and event boundary with temporary SQLite databases", () => {
  const databases: DatabaseSync[] = [];
  const directories: string[] = [];

  function createApplication(owner: string) {
    const directory = mkdtempSync(join(tmpdir(), "croco-golden-tx-"));
    directories.push(directory);
    const path = join(directory, "application.sqlite");
    const database = new DatabaseSync(path);
    const observer = new DatabaseSync(path);
    databases.push(database, observer);
    database.exec("CREATE TABLE rows (id INTEGER PRIMARY KEY, owner TEXT NOT NULL)");

    const published: RowWrittenEvent[] = [];
    const observedCommittedRows: number[] = [];
    const bus: EventBus = {
      async publish(event) {
        published.push(event as RowWrittenEvent);
        const row = observer.prepare("SELECT COUNT(*) AS count FROM rows").get() as {
          count: number;
        };
        observedCommittedRows.push(row.count);
      },
      subscribe() {},
      unsubscribe() {},
      clear() {
        published.length = 0;
      },
    };
    const config = new EventBusConfig();
    config.setEventBus(bus);
    const manager = new TxManager(createSqliteAdapter(database));
    const service = new RowService(manager, new EventPublisher(config, manager), owner);
    return { database, manager, observedCommittedRows, published, service };
  }

  afterEach(() => {
    for (const database of databases.splice(0)) {
      database.close();
    }
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("publishes after a real commit and suppresses publication after rollback", async () => {
    const app = createApplication("first");

    const committed = await app.manager.runWithOutcome(() => app.service.write(1));
    expect(committed.status).toBe("committed");
    expect(app.published.map((event) => event.id)).toEqual([1]);
    expect(app.observedCommittedRows).toEqual([1]);

    await expect(app.manager.runWithOutcome(() => app.service.write(2, true))).rejects.toThrow(
      "write rejected",
    );
    expect(app.database.prepare("SELECT id FROM rows ORDER BY id").all()).toEqual([{ id: 1 }]);
    expect(app.published.map((event) => event.id)).toEqual([1]);
    expect(app.observedCommittedRows).toEqual([1]);
  });

  it("isolates concurrent application managers, databases, and event buses", async () => {
    const first = createApplication("first");
    const second = createApplication("second");

    await Promise.all([
      first.manager.runWithOutcome(() => first.service.write(1)),
      second.manager.runWithOutcome(() => second.service.write(2)),
    ]);

    expect(first.database.prepare("SELECT id, owner FROM rows").all()).toEqual([
      { id: 1, owner: "first" },
    ]);
    expect(second.database.prepare("SELECT id, owner FROM rows").all()).toEqual([
      { id: 2, owner: "second" },
    ]);
    expect(first.published.map((event) => event.owner)).toEqual(["first"]);
    expect(second.published.map((event) => event.owner)).toEqual(["second"]);
    expect(first.observedCommittedRows).toEqual([1]);
    expect(second.observedCommittedRows).toEqual([1]);
  });
});
