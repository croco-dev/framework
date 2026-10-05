import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { Component } from "@croco/framework-context";
import { DomainEvent, EventBusConfig, EventPublisher } from "@croco/events-core";
import { InMemoryEventBus } from "@croco/events-inmemory";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { TxManager } from "@croco/tx-core";
import type { EventBus } from "@croco/events-core";
import type { TxAdapter } from "@croco/tx-core";

export const PRODUCT = {
  id: "launch-brief",
  title: "Launch brief",
  description: "Turn a product idea and audience into a private, saved launch brief.",
} as const;

export type TrialIdentity = { userId: string; tenantId: string };
export const trialInputSchema = z.object({
  commandId: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
  audience: z.string().trim().min(1).max(160),
});
export type TrialInput = z.infer<typeof trialInputSchema>;
export type TrialResult = {
  id: string;
  title: string;
  audience: string;
  brief: string;
  eventId: string;
  correlationId: string;
  createdAt: string;
};
export type TrialCreated = TrialResult & { observation: "succeeded" | "failed" | "not-repeated" };

export class TrialProblem extends Problem {
  constructor(code: string, category: ProblemCategory, detail: string, cause?: Error) {
    super(code, category, detail, { cause });
  }
}

function migrationRequired(): TrialProblem {
  return new TrialProblem(
    "TRIAL_MIGRATION_REQUIRED",
    ProblemCategory.InternalServerError,
    "Run pnpm migrate before starting the app.",
  );
}

export class TrialCommitted extends DomainEvent {
  static eventName = "product.trial.committed";
  constructor(
    readonly resultId: string,
    readonly correlationId: string,
    eventId: string,
  ) {
    super(eventId);
  }
}

function sqliteAdapter(database: DatabaseSync): TxAdapter<DatabaseSync> {
  return {
    async transaction(fn) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(database);
        database.exec("COMMIT");
        return result;
      } catch (error) {
        if (database.isTransaction) database.exec("ROLLBACK");
        throw error;
      }
    },
    async savepoint() {
      throw new TrialProblem(
        "TRIAL_NESTING_UNSUPPORTED",
        ProblemCategory.InternalServerError,
        "Nested trial transactions are unsupported.",
      );
    },
    supportsSavepoint: () => false,
  };
}

const columns =
  "id, title, audience, brief, event_id AS eventId, correlation_id AS correlationId, created_at AS createdAt";

export class ProductTrialStore {
  private readonly manager: TxManager<DatabaseSync>;
  private readonly publisher: EventPublisher;

  constructor(
    private readonly database: DatabaseSync,
    bus: EventBus,
  ) {
    const schema = database.prepare("PRAGMA user_version").get();
    if (schema?.user_version !== 1) {
      throw migrationRequired();
    }
    this.manager = new TxManager(sqliteAdapter(database));
    const config = new EventBusConfig();
    config.setEventBus(bus);
    this.publisher = new EventPublisher(config, this.manager);
  }

  async create(
    identity: TrialIdentity,
    rawInput: TrialInput,
    requestId: string,
  ): Promise<TrialCreated> {
    if (!identity.userId || !identity.tenantId) {
      throw new TrialProblem(
        "TRIAL_AUTH_REQUIRED",
        ProblemCategory.Unauthorized,
        "Sign in to create a private trial.",
      );
    }
    const parsed = trialInputSchema.safeParse(rawInput);
    if (!parsed.success || !requestId || requestId.length > 200) {
      throw new TrialProblem(
        "TRIAL_INPUT_INVALID",
        ProblemCategory.BadRequest,
        "Provide a title (1–100 characters), audience (1–160 characters), UUID command ID and request ID.",
        parsed.success ? undefined : parsed.error,
      );
    }
    const input = parsed.data;
    const outcome = await this.manager.runWithOutcome(async () => {
      const existing = this.database
        .prepare(
          `SELECT ${columns} FROM product_trials WHERE tenant_id = ? AND user_id = ? AND command_id = ?`,
        )
        .get(identity.tenantId, identity.userId, input.commandId) as TrialResult | undefined;
      if (existing) {
        if (existing.title !== input.title || existing.audience !== input.audience) {
          throw new TrialProblem(
            "TRIAL_COMMAND_CONFLICT",
            ProblemCategory.Conflict,
            "This command ID already belongs to different input. Start a new trial.",
          );
        }
        return { result: existing, repeated: true };
      }
      const result: TrialResult = {
        id: randomUUID(),
        title: input.title,
        audience: input.audience,
        brief: `${input.title} — launch brief\n\nAudience: ${input.audience}.\n\nPositioning: Introduce ${input.title} to ${input.audience} with one clear promise and a concrete example.\n\nFirst experiment: Share a short demonstration with five people from this audience. Ask what they would use it for and what would stop them.\n\nSuccess signal: Record how many ask to try ${input.title}, then use their feedback to refine the next demonstration.`,
        eventId: randomUUID(),
        correlationId: requestId,
        createdAt: new Date().toISOString(),
      };
      this.database
        .prepare(
          "INSERT INTO product_trials (id, tenant_id, user_id, command_id, title, audience, brief, event_id, correlation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          result.id,
          identity.tenantId,
          identity.userId,
          input.commandId,
          result.title,
          result.audience,
          result.brief,
          result.eventId,
          result.correlationId,
          result.createdAt,
        );
      this.database
        .prepare(
          "INSERT INTO product_trial_facts (event_id, result_id, tenant_id, user_id, correlation_id, occurred_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          result.eventId,
          result.id,
          identity.tenantId,
          identity.userId,
          result.correlationId,
          result.createdAt,
        );
      this.publisher.publishAfterCommit(
        new TrialCommitted(result.id, result.correlationId, result.eventId),
      );
      return { result, repeated: false };
    });
    return {
      ...outcome.value.result,
      observation: outcome.value.repeated ? "not-repeated" : outcome.afterCommit.status,
    };
  }

  get(identity: TrialIdentity, id: string): TrialResult {
    const result = this.database
      .prepare(
        `SELECT ${columns} FROM product_trials WHERE id = ? AND tenant_id = ? AND user_id = ?`,
      )
      .get(id, identity.tenantId, identity.userId) as TrialResult | undefined;
    if (!result) {
      throw new TrialProblem("TRIAL_NOT_FOUND", ProblemCategory.NotFound, "Trial not found.");
    }
    return result;
  }
}

class TrialObservationHandler {
  handle(event: DomainEvent): void {
    if (!(event instanceof TrialCommitted)) {
      throw new TrialProblem(
        "TRIAL_EVENT_INVALID",
        ProblemCategory.InternalServerError,
        "Unexpected trial observation event.",
      );
    }
    console.info(
      JSON.stringify({
        eventName: event.eventName,
        eventId: event.eventId,
        resultId: event.resultId,
        correlationId: event.correlationId,
      }),
    );
  }
}

function createObservationBus(): EventBus {
  const bus = new InMemoryEventBus();
  bus.subscribe({
    eventName: TrialCommitted.eventName,
    handlerClass: TrialObservationHandler,
    handler: new TrialObservationHandler(),
  });
  return bus;
}

export function productDatabasePath(): string {
  return process.env.CROCO_PRODUCT_DATABASE ?? ".local/product.sqlite";
}

@Component()
export class ProductTrials {
  private pendingCreate: Promise<unknown> = Promise.resolve();

  private async withStore<T>(action: (store: ProductTrialStore) => T | Promise<T>): Promise<T> {
    const path = productDatabasePath();
    if (!existsSync(path)) {
      throw migrationRequired();
    }
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(path);
      return await action(new ProductTrialStore(database, createObservationBus()));
    } catch (error) {
      if (error instanceof Problem) throw error;
      throw new TrialProblem(
        "TRIAL_STORAGE_FAILED",
        ProblemCategory.InternalServerError,
        "The product database operation failed.",
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      database?.close();
    }
  }

  create(identity: TrialIdentity, input: TrialInput, requestId: string): Promise<TrialCreated> {
    const run = () => this.withStore((store) => store.create(identity, input, requestId));
    const operation = this.pendingCreate.then(run, run);
    this.pendingCreate = operation;
    return operation;
  }

  get(identity: TrialIdentity, id: string): Promise<TrialResult> {
    return this.withStore((store) => store.get(identity, id));
  }
}
