import "reflect-metadata";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  EngagementService,
  InMemoryRecipientDirectory,
  RegistryEngagementMessageRenderer,
  MessageRendererRegistry,
  InMemoryMessageRendererResolver,
  Renders,
  StoreBackedRecipientDirectory,
  StoredEngagementPolicyEvaluator,
  ReminderService,
  createReminderEngagementSender,
  defineMessage,
  nextOccurrence,
  ReminderAccessDeniedProblem,
  ReminderInvalidProblem,
} from "@croco/engagement-core";
import type {
  ReminderAccess,
  ReminderInput,
  MessageRenderer,
  MessageContext,
} from "@croco/engagement-core";
import {
  DrizzleEngagementStore,
  DrizzleReminderStore,
  createEngagementSchema,
  engagementContactEndpoints,
  engagementDeliveryEvents,
  engagementDispatchTargets,
  engagementDispatches,
  engagementPreferences,
  engagementSuppressions,
  engagementReminderBuckets,
  engagementReminders,
  engagementReminderOccurrences,
  engagementReminderMutations,
} from "@croco/engagement-drizzle";
import type { DrizzleEngagementClient, DrizzleReminderClient } from "@croco/engagement-drizzle";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { Problem } from "@croco/problems-core";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";
import { ReminderDueTrigger } from "./trigger";

async function main(): Promise<void> {
  const databaseUrl = process.env.REMINDER_EXAMPLE_DATABASE_URL;
  if (!databaseUrl) throw new ReminderInvalidProblem("REMINDER_EXAMPLE_DATABASE_URL is required");
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const contactsDb: DrizzleEngagementClient = drizzle(pool, {
    schema: {
      engagementContactEndpoints,
      engagementDeliveryEvents,
      engagementDispatchTargets,
      engagementDispatches,
      engagementPreferences,
      engagementSuppressions,
    },
  });
  const reminderDb: DrizzleReminderClient = drizzle(pool, {
    schema: {
      engagementReminderBuckets,
      engagementReminders,
      engagementReminderOccurrences,
      engagementReminderMutations,
    },
  });
  const txManager = new TxManager(createDrizzleTxAdapter(contactsDb));
  // Explicit demo migration command at startup; production migration is deployment-owned.
  if (process.argv.includes("--migrate")) {
    await createEngagementSchema(db);
    await db.execute(
      sql`create table if not exists reminder_demo_receipts (idempotency_key text primary key, execution_id text not null)`,
    );
    await db.execute(
      sql`create table if not exists reminder_demo_resource (id text primary key, state text not null check(state in ('active','completed','deleted')))`,
    );
    await db.execute(
      sql`insert into reminder_demo_resource (id,state) values ('task-1','active') on conflict do nothing`,
    );
    const contacts = new DrizzleEngagementStore(contactsDb, txManager);
    await contacts.saveEndpoint({
      id: "demo-email",
      tenantId: "demo-tenant",
      recipientId: "demo-user",
      kind: "email",
      address: "synthetic@example.invalid",
      lastSeenAt: new Date(),
    });
    await contacts.setPreference({
      tenantId: "demo-tenant",
      recipientId: "demo-user",
      scope: "recipient",
      topic: "tasks",
      channel: "email",
      state: "allow",
      source: "explicit-local-fixture",
      changedAt: new Date(),
    });
    await pool.end();
    return;
  }
  const store = new DrizzleReminderStore(reminderDb);
  const contacts = new DrizzleEngagementStore(contactsDb, txManager);
  const scope = { app: "reminders-example", environment: "local", tenantId: "demo-tenant" };
  const user = "demo-user";
  const access = (operator = false): ReminderAccess => ({
    scope,
    subject: user,
    actor: {
      id: operator ? "demo-operator" : user,
      reason: operator ? "Reminder worker and inspection" : "User requested reminder change",
    },
  });
  const message = defineMessage({
    id: "tasks.user-reminder",
    topic: "tasks",
    channels: ["email"],
    data: z.object({ resource: z.string() }),
  });
  @Renders(message)
  class TaskReminderRenderer implements MessageRenderer<typeof message> {
    email({ data }: MessageContext<typeof message, "email">) {
      return {
        subject: "Your requested task reminder",
        html: "<p>Remember your task.</p>",
        text: `Remember ${data.resource}.`,
      };
    }
  }
  const renderers = new MessageRendererRegistry();
  renderers.registerMessage(message);
  renderers.registerRenderer(TaskReminderRenderer);
  renderers.bootstrap();
  const resolver = new InMemoryMessageRendererResolver();
  resolver.register(message, new TaskReminderRenderer());
  const engagement = new EngagementService(
    new StoreBackedRecipientDirectory(
      new InMemoryRecipientDirectory([
        { recipient: { tenantId: scope.tenantId, userId: user }, push: [] },
      ]),
      contacts,
    ),
    new RegistryEngagementMessageRenderer(renderers, resolver),
    {
      prepareDispatch: () => ({
        dispatch: async (_payload, options) => {
          const executionId = randomUUID();
          const result = await pool.query<{ execution_id: string }>(
            "insert into reminder_demo_receipts(idempotency_key,execution_id) values ($1,$2) on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key returning execution_id",
            [options.idempotencyKey, executionId],
          );
          return { executionId: result.rows[0].execution_id, providerName: "synthetic-local" };
        },
      }),
    },
    new StoredEngagementPolicyEvaluator(contacts, contacts),
    contacts,
  );
  const reminders = new ReminderService({
    store,
    clock: () => new Date(),
    authorize: async (target, _action) =>
      target.scope.app === scope.app &&
      target.scope.environment === scope.environment &&
      target.scope.tenantId === scope.tenantId &&
      target.subject === user &&
      (target.actor.id === user || target.actor.id === "demo-operator"),
    validateInput: async (_target, input) => {
      if (input.topic !== "tasks" || input.resourceRef !== "task-1" || input.channel !== "email")
        throw new ReminderAccessDeniedProblem();
    },
    resourceState: async (reminder) => {
      const result = await pool.query<{ state: "active" | "completed" | "deleted" }>(
        "select state from reminder_demo_resource where id=$1",
        [reminder.resourceRef],
      );
      return result.rows[0]?.state ?? "deleted";
    },
    send: createReminderEngagementSender(engagement, [
      { message, data: async (reminder) => ({ resource: reminder.resourceRef }) },
    ]),
  });
  const trigger = new ReminderDueTrigger(reminders, async () => [access(true)]);
  const snapshot = async () => ({
    reminders: await reminders.list(access()),
    occurrences: await reminders.history(access()),
    referenceTime: new Date().toISOString(),
  });
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      if (path === "/" || path === "/dist/browser.global.js") {
        const content = await readFile(
          join(process.cwd(), path === "/" ? "index.html" : "dist/browser.global.js"),
        );
        response
          .writeHead(200, {
            "content-type":
              path === "/" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8",
          })
          .end(content);
        return;
      }
      if (path === "/api/reminders" && request.method === "GET") {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(await snapshot()));
        return;
      }
      if (request.method !== "POST") {
        response.writeHead(404).end();
        return;
      }
      // Fixed synthetic identity, loopback only. Production hosts resolve authentication and authorization server-side.
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > 16384) throw new ReminderInvalidProblem("Request body is too large");
        chunks.push(bytes);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as Record<string, unknown>;
      const id = typeof body.id === "string" ? body.id : "";
      const expectedVersion = Number(body.expectedVersion);
      const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
      const command = { ...access(), id, expectedVersion, idempotencyKey };
      switch (path) {
        case "/api/preview": {
          const input = body.input as ReminderInput;
          const next = nextOccurrence(input.schedule, input.timezone, new Date());
          response.setHeader("content-type", "application/json");
          response.end(
            JSON.stringify({
              scheduledAt: next.toISOString(),
              local: next.toLocaleString("en-US", { timeZone: input.timezone }),
              utc: next.toISOString(),
            }),
          );
          return;
        }
        case "/api/create":
          await reminders.create({ ...command, input: body.input as ReminderInput });
          break;
        case "/api/update":
          await reminders.update({ ...command, input: body.input as ReminderInput });
          break;
        case "/api/snooze":
          await reminders.snooze({ ...command, until: new Date(String(body.until)) });
          break;
        case "/api/cancel":
          await reminders.cancel(command);
          break;
        case "/api/operator-cancel": {
          if (typeof body.reason !== "string" || !body.reason.trim())
            throw new ReminderInvalidProblem("An operator cancellation reason is required");
          await reminders.cancel({
            ...command,
            ...access(true),
            actor: { id: "demo-operator", reason: body.reason },
          });
          break;
        }
        case "/api/tick":
          await trigger.tick();
          break;
        default:
          response.writeHead(404).end();
          return;
      }
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(await snapshot()));
    } catch (error) {
      response
        .writeHead(error instanceof Problem ? error.status : 500, {
          "content-type": "application/json",
        })
        .end(
          JSON.stringify({
            code: error instanceof Problem ? error.code : "reminder-example/request-failed",
            detail: error instanceof Error ? error.message : "Request failed",
          }),
        );
    }
  });
  server.listen(4181, "127.0.0.1", () => console.log("User reminders: http://127.0.0.1:4181/"));
  const stop = () => {
    server.close();
    void pool.end();
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
