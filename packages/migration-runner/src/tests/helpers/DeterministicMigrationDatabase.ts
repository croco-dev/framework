import type { DatabaseClient } from "../../libs/db-types";

export type MigrationBodyQuery = {
  readonly kind: "migration-body";
  readonly direction: "up" | "down";
  readonly id: string;
};

export type MigrationDatabaseSnapshot = {
  readonly tableExists: boolean;
  readonly checkpoints: readonly string[];
  readonly bodyEffects: readonly string[];
};

type MutableDatabaseState = {
  tableExists: boolean;
  checkpoints: Map<string, string>;
  bodyEffects: string[];
};

type Barrier = {
  readonly wait: () => Promise<void>;
};

export class DeterministicMigrationDatabase implements DatabaseClient {
  private state: MutableDatabaseState = {
    tableExists: false,
    checkpoints: new Map(),
    bodyEffects: [],
  };
  private selectBarrier: Barrier | undefined;
  private selectFailure: unknown;
  private transactionTail = Promise.resolve();

  readonly events: string[] = [];

  async execute(query: unknown): Promise<unknown> {
    return this.executeAgainst(this.state, query);
  }

  async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
    const previous = this.transactionTail;
    let release: (() => void) | undefined;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    const staged = cloneState(this.state);
    this.events.push("transaction:begin");

    try {
      const result = await fn({
        execute: (query) => this.executeAgainst(staged, query),
      });
      this.state = staged;
      this.events.push("transaction:commit");
      return result;
    } catch (error) {
      this.events.push("transaction:rollback");
      throw error;
    } finally {
      release?.();
    }
  }

  holdSelects(participantCount: number): void {
    this.selectBarrier = createBarrier(participantCount);
  }

  failNextSelect(error: unknown): void {
    this.selectFailure = error;
  }

  snapshot(): MigrationDatabaseSnapshot {
    return {
      tableExists: this.state.tableExists,
      checkpoints: Array.from(this.state.checkpoints, ([id, name]) => `${id}_${name}`),
      bodyEffects: [...this.state.bodyEffects],
    };
  }

  private async executeAgainst(state: MutableDatabaseState, query: unknown): Promise<unknown> {
    const bodyQuery = getMigrationBodyQuery(query);
    if (bodyQuery) {
      state.bodyEffects.push(`${bodyQuery.direction}:${bodyQuery.id}`);
      this.events.push(`body:${bodyQuery.direction}:${bodyQuery.id}`);
      return [];
    }

    const text = sqlText(query);
    const params = sqlParams(query);

    if (text.startsWith("CREATE TABLE")) {
      state.tableExists = true;
      this.events.push("schema:ensure");
      return [];
    }

    if (text.startsWith("SELECT id, name")) {
      const selectFailure = this.selectFailure;
      this.selectFailure = undefined;
      if (selectFailure !== undefined) {
        throw selectFailure;
      }

      const barrier = this.selectBarrier;
      if (barrier) {
        await barrier.wait();
        this.selectBarrier = undefined;
      }

      assertTableExists(state);
      this.events.push("checkpoint:select");
      return Array.from(state.checkpoints, ([id, name]) => ({
        id,
        name,
        executedAt: new Date("2026-07-11T00:00:00.000Z"),
      }));
    }

    if (text.includes("ON CONFLICT (id) DO NOTHING")) {
      assertTableExists(state);
      const [id, name] = params;
      if (!id || !name || state.checkpoints.has(id)) {
        this.events.push(`checkpoint:reserve:lost:${id ?? "unknown"}`);
        return { rows: [] };
      }

      state.checkpoints.set(id, name);
      this.events.push(`checkpoint:reserve:won:${id}`);
      return { rows: [{ id }] };
    }

    if (text.startsWith("UPDATE")) {
      assertTableExists(state);
      return [];
    }

    if (text.startsWith("DELETE FROM") && text.includes("RETURNING id")) {
      assertTableExists(state);
      const [id] = params;
      if (!id || !state.checkpoints.has(id)) {
        this.events.push(`checkpoint:claim:lost:${id ?? "unknown"}`);
        return { rows: [] };
      }

      state.checkpoints.delete(id);
      this.events.push(`checkpoint:claim:won:${id}`);
      return { rows: [{ id }] };
    }

    throw new Error(`Unsupported deterministic migration query: ${text || String(query)}`);
  }
}

function cloneState(state: MutableDatabaseState): MutableDatabaseState {
  return {
    tableExists: state.tableExists,
    checkpoints: new Map(state.checkpoints),
    bodyEffects: [...state.bodyEffects],
  };
}

function assertTableExists(state: MutableDatabaseState): void {
  if (!state.tableExists) {
    throw new Error('relation "_migrations" does not exist');
  }
}

function createBarrier(participantCount: number): Barrier {
  if (!Number.isInteger(participantCount) || participantCount < 1) {
    throw new Error("Barrier participant count must be a positive integer");
  }

  let waiting = 0;
  let release: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    async wait() {
      waiting += 1;
      if (waiting === participantCount) {
        release?.();
      }
      await ready;
    },
  };
}

function getMigrationBodyQuery(query: unknown): MigrationBodyQuery | undefined {
  if (typeof query !== "object" || query === null || !("kind" in query)) {
    return undefined;
  }

  const candidate = query as Partial<MigrationBodyQuery>;
  if (
    candidate.kind !== "migration-body" ||
    (candidate.direction !== "up" && candidate.direction !== "down") ||
    typeof candidate.id !== "string"
  ) {
    return undefined;
  }

  return {
    kind: candidate.kind,
    direction: candidate.direction,
    id: candidate.id,
  };
}

function sqlText(query: unknown): string {
  return getQueryChunks(query)
    .map((chunk) => {
      if (typeof chunk === "object" && chunk !== null && "value" in chunk) {
        const value = (chunk as { readonly value?: unknown }).value;
        return Array.isArray(value) ? value.join("") : String(value);
      }

      return "";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function sqlParams(query: unknown): string[] {
  return getQueryChunks(query).filter((chunk): chunk is string => typeof chunk === "string");
}

function getQueryChunks(query: unknown): readonly unknown[] {
  if (typeof query === "object" && query !== null && "queryChunks" in query) {
    const chunks = (query as { readonly queryChunks?: unknown }).queryChunks;
    if (Array.isArray(chunks)) {
      return chunks;
    }
  }

  return [];
}
