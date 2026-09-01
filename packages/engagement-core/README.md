# @croco/engagement-core

Typed, inspectable message definitions and explicit renderer bindings for Croco engagement features.

```ts
import {
  defineMessage,
  type MessageContext,
  type MessageRenderer,
  Renders,
} from "@croco/engagement-core";
import { z } from "zod";

const TrialEnding = defineMessage({
  id: "billing.trial-ending",
  topic: "billing",
  data: z.object({ tenantName: z.string(), upgradeUrl: z.string().url() }),
  channels: ["email", "push"],
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

@Renders(TrialEnding)
class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {
  email({ data }: MessageContext<typeof TrialEnding>) {
    return {
      subject: "Trial ending",
      html: `<p>${escapeHtml(data.tenantName)}</p>`,
      text: data.tenantName,
    };
  }

  push({ data }: MessageContext<typeof TrialEnding>) {
    return { title: "Trial ending", body: data.tenantName, deepLink: data.upgradeUrl };
  }
}
```

Register messages and renderer constructors explicitly in `MessageRendererRegistry`, then call `bootstrap()` before rendering. The decorator stores a binding only: it never registers a provider or instantiates a renderer.

## Recipient-based dispatch

Application call sites send a logical recipient, typed message data, and a semantic key. Email addresses, push tokens, provider names, preference contexts, and full idempotency keys stay behind `EngagementService`.

```ts
import {
  EngagementService,
  type EngagementNotificationDispatcher,
  InMemoryMessageRendererResolver,
  InMemoryRecipientDirectory,
  MessageRendererRegistry,
  RegistryEngagementMessageRenderer,
} from "@croco/engagement-core";

const messageRegistry = new MessageRendererRegistry();
messageRegistry.registerMessage(TrialEnding);
messageRegistry.registerRenderer(TrialEndingRenderer);
messageRegistry.bootstrap();

const rendererResolver = new InMemoryMessageRendererResolver();
rendererResolver.register(TrialEnding, new TrialEndingRenderer());

const directory = new InMemoryRecipientDirectory([
  {
    recipient: { tenantId: "tenant-1", userId: "user-1" },
    email: { id: "primary-email", address: "user@example.com" },
    push: [],
    locale: "en-US",
    timezone: "Asia/Seoul",
  },
]);

// Supplied by the application's dependency-injection container.
declare const notificationService: EngagementNotificationDispatcher;

const engagement = new EngagementService(
  directory,
  new RegistryEngagementMessageRenderer(messageRegistry, rendererResolver),
  notificationService,
);

const result = await engagement.send(TrialEnding, {
  recipient: { tenantId: "tenant-1", userId: "user-1" },
  data: { tenantName: "Croco", upgradeUrl: "https://croco.dev/upgrade" },
  key: "subscription-1",
});
```

The default `first-reachable` policy follows the message's declared channel order. Use `policy: "all-reachable"` to dispatch every usable email or push endpoint. Preference denial, suppression, and missing endpoints return explicit non-provider outcomes; recipient lookup, rendering, and provider failures remain typed Problems. `InMemoryRecipientDirectory` is intended for tests and single-process examples. Durable endpoints, preferences, and suppressions belong in storage-backed implementations.

## Audience snapshots and one-shot campaigns

Keep audience queries in application code, then connect their member type to a message with `defineCampaign()`. Every mapped member supplies a semantic key; the mapper's `data` is checked against the message schema.

```ts
import {
  Audience,
  AudienceRegistry,
  CampaignBroadcastService,
  CampaignRegistry,
  CampaignSnapshotService,
  InMemoryCampaignStore,
  campaignScopeForTenant,
  defineCampaign,
  type AudienceContext,
  type AudienceSource,
} from "@croco/engagement-core";
import type { ExecutionManager } from "@croco/execution-core";

type InactiveTrialMember = {
  recipient: { tenantId: string; userId: string };
  subscriptionId: string;
  tenantName: string;
  upgradeUrl: string;
};

interface SubscriptionRepository {
  findInactiveTrials(context: AudienceContext): AsyncIterable<InactiveTrialMember>;
}

@Audience("inactive-trials")
class InactiveTrials implements AudienceSource<InactiveTrialMember> {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  members(context: AudienceContext) {
    return this.subscriptions.findInactiveTrials(context);
  }
}

const TrialReminder = defineCampaign({
  id: "trial-reminder",
  version: "2026-09-02",
  audience: InactiveTrials,
  message: TrialEnding,
  map: (member) => ({
    recipient: member.recipient,
    data: { tenantName: member.tenantName, upgradeUrl: member.upgradeUrl },
    key: member.subscriptionId,
  }),
});

const audiences = new AudienceRegistry();
declare const subscriptions: SubscriptionRepository;
audiences.register(InactiveTrials, new InactiveTrials(subscriptions));
const campaigns = new CampaignRegistry();
campaigns.register(TrialReminder);
const store = new InMemoryCampaignStore();
const snapshots = new CampaignSnapshotService(audiences, store);
declare const executionManager: ExecutionManager;
const broadcasts = new CampaignBroadcastService(campaigns, store, executionManager, engagement);

const { snapshot } = await snapshots.createSnapshot(TrialReminder, { tenantId: "tenant-1" });
const result = await broadcasts.broadcast(
  TrialReminder,
  campaignScopeForTenant("tenant-1"),
  snapshot.id,
);
```

Snapshot creation streams the audience into an immutable, descriptor-pinned member set before any provider dispatch. Re-running the broadcast resumes from stored member outcomes and does not re-query the audience or create a second logical send for an already completed member.

For one absolute future run, inject a `CampaignExecutionPublisher` into `CampaignBroadcastService` and call `schedule()` with `scheduledFor`. The publisher receives the persisted execution ID and idempotency key, and must invoke `execute()` at the requested time. Recurring schedules and recipient-local-time fan-out are intentionally outside this contract.
