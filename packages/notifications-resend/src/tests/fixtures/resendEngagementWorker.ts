import "reflect-metadata";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { z } from "zod";
import {
  ContactPolicy,
  EngagementDeliveryEventProcessor,
  EngagementService,
  InMemoryMessageRendererResolver,
  InMemoryRecipientDirectory,
  MessageRendererRegistry,
  RegistryEngagementMessageRenderer,
  Renders,
  StoredEngagementPolicyEvaluator,
  StoreBackedRecipientDirectory,
  defineMessage,
} from "@croco/engagement-core";
import type { MessageContext, MessageRenderer } from "@croco/engagement-core";
import {
  DrizzleContactPolicyStore,
  DrizzleEngagementStore,
  engagementContactEndpoints,
  engagementContactPolicyBuckets,
  engagementContactPolicyReservations,
  engagementDeliveryEvents,
  engagementDispatchTargets,
  engagementDispatches,
  engagementPreferences,
  engagementSuppressions,
} from "@croco/engagement-drizzle";
import { ExecutionManagerImpl } from "@croco/execution-core";
import { DrizzleExecutionStore, executions } from "@croco/execution-drizzle";
import { Problem } from "@croco/problems-core";
import { TaskRegistry, TaskRunner } from "@croco/tasks-core";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { ResendProvider } from "@croco/notifications-resend";
// Repository-only assembly bridge: the registry is internal. Keep its actual service
// and task on the same source identity; the Resend provider uses its built public entrypoint.
import { NotificationProviderRegistry } from "../../../../notifications-core/src/libs/NotificationProviderRegistry";
import { NotificationService } from "../../../../notifications-core/src/libs/NotificationService";
import { SendNotificationTask } from "../../../../notifications-core/src/libs/SendNotificationTask";

type Bindings = {
  HYPERDRIVE: { connectionString: string };
  RESEND_API_KEY: string;
  RESEND_FROM: string;
};

const Message = defineMessage({
  id: "workers.welcome",
  topic: "welcome",
  data: z.object({ name: z.string() }),
  channels: ["email"],
});

@Renders(Message)
class WelcomeRenderer implements MessageRenderer<typeof Message> {
  email({ data }: MessageContext<typeof Message, "email">) {
    return {
      subject: `Welcome ${data.name}`,
      html: `<p>Hello ${data.name}</p>`,
      text: `Hello ${data.name}`,
    };
  }
}

const schema = {
  engagementContactEndpoints,
  engagementContactPolicyBuckets,
  engagementContactPolicyReservations,
  engagementDeliveryEvents,
  engagementDispatchTargets,
  engagementDispatches,
  engagementPreferences,
  engagementSuppressions,
  executions,
};

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const url = new URL(request.url);
    // Synthetic scope chosen by the test harness, not an application authorization recipe.
    const tenantId = url.searchParams.get("tenant") === "b" ? "tenant-b" : "tenant-a";
    const recipient = { tenantId, userId: "recipient" };
    const key = url.searchParams.get("key") ?? "welcome";
    const client = new Client({
      connectionString: env.HYPERDRIVE.connectionString,
      connectionTimeoutMillis: 5000,
    });
    try {
      await client.connect();
      const db = drizzle(client, { schema });
      const transactions = new TxManager(createDrizzleTxAdapter(db));
      const store = new DrizzleEngagementStore(db, transactions);
      const policyStore = new DrizzleContactPolicyStore(db);
      const policy = new ContactPolicy({
        store: policyStore,
        config: {
          version: "workers-v1",
          reservationTtlMs: 30_000,
          rules: [{ id: "welcome-day", limit: 20, windowMs: 86_400_000 }],
        },
        topics: [{ id: "welcome", kind: "marketing", priority: 1, messageIds: [Message.id] }],
      });
      const identity = {
        tenantId,
        recipientId: recipient.userId,
        messageId: Message.id,
        channel: "email" as const,
        semanticKey: key,
      };
      if (url.pathname === "/inspect") {
        const dispatch = await store.findByIdentity(identity);
        return Response.json({
          dispatch,
          events: dispatch ? await store.listByDispatch(tenantId, dispatch.id) : [],
          reservations: await policyStore.read(
            { app: "workers-resend", environment: "test", tenantId },
            `recipient:${recipient.userId}`,
          ),
        });
      }

      const registry = new NotificationProviderRegistry();
      const task = new SendNotificationTask(registry);
      const tasks = new TaskRegistry();
      tasks.register("send-notification", SendNotificationTask, "handle", {
        name: "send-notification",
        options: { maxAttempts: 1 },
        target: SendNotificationTask,
        methodName: "handle",
      });
      const runner = new TaskRunner(
        new ExecutionManagerImpl(new DrizzleExecutionStore(db as never)),
        tasks,
        undefined,
        { serviceResolver: () => task },
      );
      const notifications = new NotificationService(runner, registry);
      notifications.registerProvider(
        new ResendProvider({ apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM }),
        true,
      );
      const renderers = new MessageRendererRegistry();
      renderers.registerMessage(Message);
      renderers.registerRenderer(WelcomeRenderer);
      renderers.bootstrap();
      const resolver = new InMemoryMessageRendererResolver();
      resolver.register(Message, new WelcomeRenderer());
      const service = new EngagementService(
        new StoreBackedRecipientDirectory(
          new InMemoryRecipientDirectory([{ recipient, push: [] }]),
          store,
        ),
        new RegistryEngagementMessageRenderer(renderers, resolver),
        notifications,
        new StoredEngagementPolicyEvaluator(store, store, { globalDefault: "allow" }),
        store,
        () => new Date(),
        {
          app: "workers-resend",
          environment: "test",
          policy,
          fingerprint: (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex"),
        },
        new EngagementDeliveryEventProcessor(store),
      );
      // Each store commits its own transaction before/after the external send. An outer
      // transaction would roll back unknown-acceptance evidence after a provider side effect.
      return Response.json(
        await service.send(Message, { recipient, key, data: { name: "private-recipient-name" } }),
      );
    } catch (error) {
      if (error instanceof Problem) return Response.json(error.toJSON(), { status: error.status });
      throw error;
    } finally {
      await client.end();
    }
  },
};
